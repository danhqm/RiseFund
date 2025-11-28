import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Initialize Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: generate a random file name
const generateFileName = () => `receipt_${Date.now()}.png`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res.status(400).json({ success: false, error: "Missing imageBase64 or userId" });
    }

    // ----------------------------
    // 1️⃣ Upload image to Supabase
    // ----------------------------
    const fileName = generateFileName();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts") // your bucket name
      .upload(fileName, Buffer.from(imageBase64, "base64"), {
        contentType: "image/png",
      });

    if (uploadError) throw uploadError;

    // Get public URL for uploaded image
    const { publicUrl } = supabase.storage.from("receipts").getPublicUrl(fileName);

    // ----------------------------
    // 2️⃣ Send image to OpenAI for OCR
    // ----------------------------
    // OpenAI can process images via the "responses.create" endpoint
    // If using text-only OCR, you could also use GPT to extract info from text
    // Here we assume we send base64 text for extraction
    const prompt = `
      You are a financial assistant.
      Extract the following details from this receipt text:
      - merchant_name
      - total_amount
      - receipt_date (YYYY-MM-DD)
      - items (array of {name, price})
      Text: ${imageBase64}
    `;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const extractedText = response.output_text || "";

    // For demo, we will parse some dummy data (replace with real parsing logic)
    const receiptData = {
        merchant_name: "Example Store",
        total_amount: 123.45,
        receipt_date: new Date().toISOString().split("T")[0],
        items: [
            { name: "Item 1", price: 50 },
            { name: "Item 2", price: 73.45 },
        ],
        };

        // Use a dummy UUID for testing
    const dummyUserId = "11111111-1111-1111-1111-111111111111";

    const { data: savedReceipt, error: insertError } = await supabase
        .from("receipts")
        .insert([
            {
            user_id: dummyUserId, // must be a valid UUID
            merchant_name: receiptData.merchant_name,
            total_amount: receiptData.total_amount, // number
            receipt_date: receiptData.receipt_date, // string in YYYY-MM-DD
            items: receiptData.items, // JSON array
            },
        ])
        .select()
        .single();

    if (insertError) throw insertError;


    return res.status(200).json({ success: true, data: savedReceipt });
  } catch (err) {
    console.error("OCR error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
