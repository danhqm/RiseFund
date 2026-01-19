import { createClient } from "@supabase/supabase-js";
import express from "express";
import OpenAI from "openai";

const router = express.Router();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/ocr", async (req, res) => {
  console.log("🚀 /api/ocr request body:", req.body);

  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing imageBase64 or userId" });
    }

    // 1️⃣ Upload image to Supabase Storage
    let imageUrl;
    try {
      console.log("📤 Uploading image to Supabase...");
      const fileName = `receipt-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, Buffer.from(imageBase64, "base64"), {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      imageUrl = pub.publicUrl;
      console.log("✅ Image uploaded:", imageUrl);
    } catch (err) {
      console.error("❌ Supabase upload error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Supabase upload failed" });
    }

    // 2️⃣ Call OpenAI to extract receipt data
    let receiptData;
    try {
      console.log("🤖 Sending image to OpenAI for analysis...");

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Extract the receipt data from this image. " +
                  "Return ONLY valid JSON in this exact format: " +
                  `{
                    "merchant_name": "string",
                    "total_amount": number,
                    "receipt_date": "YYYY-MM-DD",
                    "items": [{"name": "string", "price": number}]
                  }`,
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
      });

      console.log("🔍 Raw OpenAI response:", JSON.stringify(response, null, 2));

      const first = response.output[0]?.content[0];
      const outputText =
        (first && "text" in first && first.text) ||
        (typeof first === "string" ? first : "");

      if (!outputText) {
        throw new Error("No text output from OpenAI");
      }

      console.log("📝 OpenAI output text:", outputText);
      receiptData = JSON.parse(outputText);
    } catch (err) {
      console.error("❌ OpenAI extraction error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to extract receipt data from image",
      });
    }

    // 3️⃣ Insert into Supabase receipts table
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
      return res
        .status(500)
        .json({ success: false, error: "Failed to save receipt" });
    }

    // 4️⃣ Success
    return res.json({ success: true, data: savedReceipt });
  } catch (err) {
    console.error("💥 Top-level OCR handler error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Unexpected server error in OCR" });
  }
});

export default router;
