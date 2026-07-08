//api/ocr.js
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  console.log("🚀 /api/ocr invoked");

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    // 🌟 NEW 1: Catch the LHDN categories from the React Native app
    const { imageBase64, userId, lhdnCategory, lhdnSubcategory } =
      req.body || {};
    console.log("BODY:", {
      hasImage: !!imageBase64,
      userId,
      lhdnCategory,
      lhdnSubcategory,
    });

    if (!imageBase64 || !userId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing imageBase64 or userId" });
    }

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

      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
      console.log("✅ Image uploaded, signed URL:", imageUrl);
    } catch (err) {
      console.error("❌ Supabase upload error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Supabase upload failed" });
    }

    let receiptData;
    let finalCategory = "OTHER";

    try {
      console.log("🤖 Sending image to OpenAI for analysis...");

      let promptText =
        "Extract the receipt data from this image. Return ONLY valid JSON. No code fences, no commentary. ";

      if (lhdnCategory) {
        promptText += `The user claims this receipt is for LHDN tax relief category: '${lhdnCategory}'. Validate if the items make sense for this claim. `;
        promptText += `Format: { "merchant_name": "string", "total_amount": number, "receipt_date": "YYYY-MM-DD", "items": [{"name": "string", "price": number}], "is_valid_claim": boolean }`;
      } else {
        promptText +=
          "You are an expert personal finance assistant. Analyze the merchant name and the purchased items to determine the overarching spending category. ";
        promptText +=
          "You MUST categorize the receipt into exactly one of these predefined categories based on their definitions: ";
        promptText +=
          "1. 'FOOD_AND_DRINK': Prepared meals, restaurants, cafes, and fast food. ";
        promptText +=
          "2. 'GROCERIES': Supermarkets, raw food ingredients, and basic household consumables. ";
        promptText +=
          "3. 'TRANSPORT': Commuting, ride-hailing, petrol, parking, and tolls. ";
        promptText +=
          "4. 'SHOPPING': Retail goods, physical products, e-commerce, electronics, hardware, clothing, and personal items. ";
        promptText +=
          "5. 'BILLS': Utilities, telecommunications, and recurring services. ";
        promptText +=
          "6. 'ENTERTAINMENT': Leisure activities, movies, gaming, and digital subscriptions. ";
        promptText +=
          "7. 'OTHER': Only use this as a last resort if it truly fits none of the above concepts. ";
        promptText += `Return the exact category string. Format: { "merchant_name": "string", "total_amount": number, "receipt_date": "YYYY-MM-DD", "items": [{"name": "string", "price": number}], "category": "SHOPPING" }`;
      }

      // ✅ FIX 1 & 2: Use chat.completions and 'messages'
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" }, // Pro-tip: Forces OpenAI to return valid JSON
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text", // ✅ FIX 3: Must be "text"
                text: promptText,
              },
              {
                type: "image_url", // ✅ FIX 3: Must be "image_url"
                image_url: {
                  url: imageUrl, // Must be passed inside a 'url' object
                },
              },
            ],
          },
        ],
      });

      console.log("🔍 Raw OpenAI response:", JSON.stringify(response, null, 2));

      // ✅ FIX 4: Correctly parse the standard OpenAI response object
      const outputText = response.choices[0]?.message?.content || "";

      if (!outputText) {
        throw new Error("No text output from OpenAI");
      }

      console.log("📝 OpenAI output text:", outputText);

      // (The rest of your cleaning and JSON parsing remains exactly the same!)
      const cleaned = outputText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      console.log("🧽 CLEANED JSON:", cleaned);

      receiptData = JSON.parse(cleaned);

      if (!lhdnCategory) {
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

        finalCategory = validCategories.includes(llmCategory)
          ? llmCategory
          : categorizeLine(
              receiptData.merchant_name ||
                JSON.stringify(receiptData.items || []),
            );
      } else {
        finalCategory = "TAX_RELIEF"; // Overwrite the main category if it's an LHDN claim
      }
    } catch (err) {
      console.error("❌ OpenAI extraction error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to extract receipt data from image",
      });
    }

    let savedReceipt;
    try {
      console.log("💾 Inserting receipt into Supabase table...");

      // 🌟 NEW 3: Calculate the year and insert the 3 new fields into Supabase
      const currentTaxYear = new Date().getFullYear();

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
            lhdn_category: lhdnCategory || null,
            lhdn_subcategory: lhdnSubcategory || null,
            tax_year: lhdnCategory ? currentTaxYear : null,
            ai_validation_passed:
              receiptData.is_valid_claim !== undefined
                ? receiptData.is_valid_claim
                : null,
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

    return res.json({ success: true, data: savedReceipt });
  } catch (err) {
    console.error("💥 Top-level OCR handler error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Unexpected server error in OCR" });
  }
}
