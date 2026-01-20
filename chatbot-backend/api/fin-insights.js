import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  console.log("🤖 /api/fin-insights invoked");

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    // 1️⃣ Get recent receipts for this user (last 60 days, max 50 rows)
    const today = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);

    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("merchant_name, total_amount, category, receipt_date, created_at")
      .eq("user_id", userId)
      .gte("receipt_date", sixtyDaysAgo.toISOString().split("T")[0])
      .order("receipt_date", { ascending: false })
      .limit(50);

    if (receiptsError) {
      console.error("❌ receiptsError:", receiptsError);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load receipts" });
    }

    if (!receipts || receipts.length === 0) {
      return res.json({
        success: true,
        insights: [
          "Fin couldn't find any receipts yet. Scan a few receipts to let Fin analyse your spending.",
        ],
      });
    }

    const receiptsJson = JSON.stringify(receipts);

    // 2️⃣ Call OpenAI to generate insights
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are Fin, an AI financial coach helping a young adult improve their money habits. " +
                "You will receive their recent receipt data as JSON from a mobile app. " +
                "Your job is to generate 3 to 5 short, friendly insights about their spending. " +
                "Focus on patterns (top categories, increases/decreases, frequency) and give practical hints. " +
                "Use a casual but respectful tone suitable for a Gen Z student. " +
                "Return ONLY valid JSON: an array of strings. No explanations, no markdown, no extra fields.\n\n" +
                "Here is the JSON array of receipts:\n" +
                receiptsJson +
                "\n\nExpected output format example:\n" +
                '["You spent more on food delivery this week compared to last week.", "Most of your spending is in FOOD_AND_DRINK."]',
            },
          ],
        },
      ],
    });

    console.log(
      "🔍 Raw OpenAI insights response:",
      JSON.stringify(response, null, 2),
    );

    const first = response.output[0]?.content[0];
    const outputText =
      (first && "text" in first && first.text) ||
      (typeof first === "string" ? first : "");

    if (!outputText) {
      throw new Error("No text output from OpenAI for insights");
    }

    const cleaned = outputText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let insights;
    try {
      insights = JSON.parse(cleaned);
      if (!Array.isArray(insights)) {
        throw new Error("Output is not an array");
      }
    } catch (parseErr) {
      console.error("❌ Failed to parse AI insights JSON:", parseErr, cleaned);
      return res.status(500).json({
        success: false,
        error: "Failed to parse AI insights output",
      });
    }

    return res.json({ success: true, insights });
  } catch (err) {
    console.error("💥 /api/fin-insights top-level error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Unexpected server error" });
  }
}
