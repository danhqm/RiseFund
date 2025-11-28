import express from "express";
import OpenAI from "openai";
import { supabase } from "../utils/supabase.js"; // your supabase client with service key

const router = express.Router();

router.post("/ocr", async (req, res) => {
  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res.status(400).json({ success: false, error: "Missing imageBase64 or userId" });
    }

    // -------------------------------
    // 1️⃣ Upload image to Supabase bucket
    // -------------------------------
    const fileName = `receipt-${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, Buffer.from(imageBase64, "base64"), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return res.status(500).json({ success: false, error: uploadError.message });
    }

    const imageUrl = supabase.storage.from("receipts").getPublicUrl(fileName).publicUrl;

    // -------------------------------
    // 2️⃣ Send image to OpenAI for analysis
    // -------------------------------
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Extract the receipt data from this image.
Return the result as JSON like:
{
  "merchant_name": "...",
  "total_amount": ...,
  "receipt_date": "...",
  "items": [{"name": "...", "price": ...}]
}
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
    });

    const outputText = response.output_text;

    let receiptData;
    try {
      receiptData = JSON.parse(outputText);
    } catch (err) {
      console.error("JSON parse error:", err);
      return res.status(500).json({ success: false, error: "Failed to parse OpenAI response" });
    }

    // -------------------------------
    // 3️⃣ Insert extracted data into Supabase
    // -------------------------------
    const { data: savedReceipt, error: insertError } = await supabase
      .from("receipts")
      .insert([
        {
          user_id: userId,
          merchant_name: receiptData.merchant_name,
          total_amount: receiptData.total_amount,
          receipt_date: receiptData.receipt_date,
          items: receiptData.items,
          image_url: imageUrl,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ success: false, error: insertError.message });
    }

    return res.json({ success: true, data: savedReceipt });
  } catch (err) {
    console.error("OCR error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
