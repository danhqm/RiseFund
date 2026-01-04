import express from "express";
import OpenAI from "openai";
import { supabase } from "../utils/supabase.js"; // using service key

const router = express.Router();

router.post("/ocr", async (req, res) => {
  console.log("🚀 Received request body:", req.body);

  const { imageBase64, userId } = req.body;

  if (!imageBase64 || !userId) {
    return res.status(400).json({ success: false, error: "Missing imageBase64 or userId" });
  }

  // Step 1: Upload image to Supabase
  let imageUrl;
  try {
    console.log("📤 Uploading image to Supabase...");
    const fileName = `receipt-${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, Buffer.from(imageBase64, "base64"), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    imageUrl = supabase.storage.from("receipts").getPublicUrl(fileName).publicUrl;
    console.log("✅ Image uploaded:", imageUrl);
  } catch (err) {
    console.error("❌ Supabase upload error:", err);
    return res.status(500).json({ success: false, error: "Supabase upload failed" });
  }

  // Step 2: Call OpenAI to extract receipt data
  let receiptData;
  try {
    console.log("🤖 Sending image to OpenAI for analysis...");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
    Extract the receipt data from this image.
    Return JSON:
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
    console.log("📝 OpenAI output:", outputText);

    receiptData = JSON.parse(outputText);
  } catch (err) {
    console.error("❌ OpenAI extraction error:", err);
    return res.status(500).json({ success: false, error: "Failed to extract receipt data" });
  }

  // Step 3: Insert into Supabase receipts table
  let savedReceipt;
  try {
    console.log("💾 Inserting receipt into Supabase table...");
    const { data, error: insertError } = await supabase
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

    if (insertError) throw insertError;
    savedReceipt = data;
    console.log("✅ Receipt saved:", savedReceipt);
  } catch (err) {
    console.error("❌ Supabase insert error:", err);
    return res.status(500).json({ success: false, error: "Failed to save receipt" });
  }

  // Step 4: Return result
  return res.json({ success: true, data: savedReceipt });
});

export default router;
