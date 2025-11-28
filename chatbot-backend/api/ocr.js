import OpenAI from "openai";
import { supabase } from "../../utils/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res.status(400).json({ error: "Missing imageBase64 or userId" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // -----------------------------
    // 1️⃣ Use OpenAI to extract receipt data
    // -----------------------------
    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
        Extract receipt data from this base64 image.
        Provide: merchant_name, total_amount, receipt_date, items (name & price).
        Base64 image: ${imageBase64}
      `,
    });

    const text = completion.output_text;

    // -----------------------------
    // 2️⃣ For now, mock receipt data (replace with actual parsing later)
    // -----------------------------
    const receiptData = {
      merchant_name: "Test Merchant",
      total_amount: 123.45,
      receipt_date: "2025-11-29",
      items: [
        { name: "Item A", price: 50 },
        { name: "Item B", price: 73.45 },
      ],
    };

    // -----------------------------
    // 3️⃣ Upload image to Supabase Storage
    // -----------------------------
    const fileBuffer = Buffer.from(imageBase64, "base64");
    const filename = `user-${userId}-${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filename, fileBuffer, {
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ success: false, error: uploadError.message });
    }

    const imageUrl = supabase.storage.from("receipts").getPublicUrl(filename).data.publicUrl;

    // -----------------------------
    // 4️⃣ Insert into Supabase receipts table
    // -----------------------------
    const { data, error } = await supabase.from("receipts").insert([
      {
        user_id: userId,
        merchant_name: receiptData.merchant_name,
        total_amount: receiptData.total_amount,
        receipt_date: receiptData.receipt_date,
        items: receiptData.items,
        image_url: imageUrl, // optional column to store image URL
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // -----------------------------
    // 5️⃣ Return JSON to frontend
    // -----------------------------
    res.status(200).json({
      success: true,
      data: { ...receiptData, imageUrl },
    });
  } catch (err) {
    console.error("OCR Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
