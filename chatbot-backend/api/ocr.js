import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function categorizeLine(desc = "") {
  const d = desc.toLowerCase();

  if (
    d.includes("kfc") ||
    d.includes("mcd") ||
    d.includes("mcdonald") ||
    d.includes("burger king") ||
    d.includes("starbucks") ||
    d.includes("restaurant") ||
    d.includes("cafe")
  ) {
    return "FOOD_AND_DRINK";
  }

  if (
    d.includes("tesco") ||
    d.includes("lotus") ||
    d.includes("jaya grocer") ||
    d.includes("aeon") ||
    d.includes("grocer")
  ) {
    return "GROCERIES";
  }

  if (
    d.includes("grab") ||
    d.includes("gojek") ||
    d.includes("taxi") ||
    d.includes("toll") ||
    d.includes("petrol") ||
    d.includes("fuel")
  ) {
    return "TRANSPORT";
  }

  if (
    d.includes("shopee") ||
    d.includes("lazada") ||
    d.includes("zalora") ||
    d.includes("uniqlo") ||
    d.includes("mall") ||
    d.includes("store")
  ) {
    return "SHOPPING";
  }

  if (
    d.includes("maxis") ||
    d.includes("celcom") ||
    d.includes("digi") ||
    d.includes("tng") ||
    d.includes("touch n go") ||
    d.includes("electric") ||
    d.includes("water") ||
    d.includes("bill")
  ) {
    return "BILLS";
  }

  if (
    d.includes("netflix") ||
    d.includes("spotify") ||
    d.includes("cinema") ||
    d.includes("movie") ||
    d.includes("game")
  ) {
    return "ENTERTAINMENT";
  }

  return "OTHER";
}

export default async function handler(req, res) {
  console.log("🚀 /api/ocr invoked");

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, userId } = req.body || {};
    console.log("BODY:", { hasImage: !!imageBase64, userId });

    if (!imageBase64 || !userId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing imageBase64 or userId" });
    }

    // 1️⃣ Upload to Supabase
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

      // 🔑 Create a signed URL that OpenAI can access
      const { data: signed, error: signedError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(fileName, 60 * 10); // 10 minutes

      if (signedError) throw signedError;

      imageUrl = signed.signedUrl;
      console.log("✅ Image uploaded, signed URL:", imageUrl);
    } catch (err) {
      console.error("❌ Supabase upload error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Supabase upload failed" });
    }

    // 2️⃣ Call OpenAI
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
                  "Return ONLY valid JSON. No code fences, no commentary. " +
                  "Infer a high-level spending category. Allowed categories: " +
                  "FOOD_AND_DRINK, GROCERIES, TRANSPORT, SHOPPING, BILLS, ENTERTAINMENT, OTHER. " +
                  "Format: " +
                  `{
                    "merchant_name": "string",
                    "total_amount": number,
                    "receipt_date": "YYYY-MM-DD",
                    "items": [{"name": "string", "price": number}],
                    "category": "FOOD_AND_DRINK" // one of the allowed values
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

      // 🧼 CLEANUP STEP — strip ```json fences
      const cleaned = outputText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      console.log("🧽 CLEANED JSON:", cleaned);

      receiptData = JSON.parse(cleaned);
      const llmCategory = (receiptData.category || "").toUpperCase();
      const validCategories = [
        "FOOD_AND_DRINK",
        "GROCERIES",
        "TRANSPORT",
        "SHOPPING",
        "BILLS",
        "ENTERTAINMENT",
        "OTHER",
      ];

      let finalCategory = validCategories.includes(llmCategory)
        ? llmCategory
        : categorizeLine(
            receiptData.merchant_name ||
              JSON.stringify(receiptData.items || []),
          );
    } catch (err) {
      console.error("❌ OpenAI extraction error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to extract receipt data from image",
      });
    }

    // 3️⃣ Insert into DB
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
            category: finalCategory,
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
}
