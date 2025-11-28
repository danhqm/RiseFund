import { Buffer } from "buffer";
import OpenAI from "openai";
import { supabase } from "../utils/supabase.js";
global.Buffer = Buffer;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res.status(400).json({ success: false, error: "Missing imageBase64 or userId" });
    }

    // Example: Use OpenAI OCR (or GPT-4 Vision) here
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const ocrResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image: `data:image/png;base64,${imageBase64}`,
            },
            {
              type: "input_text",
              text: "Extract merchant, date, total amount, and items in JSON",
            },
          ],
        },
      ],
    });

    // Parse JSON from OpenAI response (adjust based on actual response)
    const ocrData = JSON.parse(ocrResponse.output[0].content[0].text || "{}");

    // Upload image to Supabase Storage
    const fileName = `${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, Buffer.from(imageBase64, "base64"), { contentType: "image/png" });

    if (uploadError) console.error("Supabase upload error:", uploadError);

    const imageUrl = supabase.storage.from("receipts").getPublicUrl(fileName).data.publicUrl;

    // Insert into Supabase table
    const { data, error: insertError } = await supabase
      .from("receipts")
      .insert([
        {
          user_id: userId,
          merchant_name: ocrData.merchant_name || "",
          total_amount: ocrData.total_amount || 0,
          receipt_date: ocrData.receipt_date || new Date().toISOString(),
          items: ocrData.items || [],
          image_url: imageUrl,
        },
      ])
      .select();

    if (insertError) console.error("Supabase insert error:", insertError);

    res.status(200).json({ success: true, data: data[0] });
  } catch (error) {
    console.error("OCR handler error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
