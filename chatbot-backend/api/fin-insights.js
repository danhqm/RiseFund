// api/fin-insights.js
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safeNumber(n, fallback = 0) {
  const x = typeof n === "number" ? n : parseFloat(String(n ?? ""));
  return Number.isFinite(x) ? x : fallback;
}

function extractRMAmount(text) {
  if (!text) return null;
  const m = String(text).match(/rm\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return Number.isFinite(val) ? val : null;
}

export default async function handler(req, res) {
  console.log("🤖 /api/fin-insights invoked");

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { userId } = body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let {
      monthlyIncome,
      weeklyIncomeEstimate,
      weeklyExpense,
      topSpendCategories,
      weeklyGoals,
      weekStartStr,
      weekEndStr,
    } = body;

    if (monthlyIncome === undefined || monthlyIncome === null) {
      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("monthly_income")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileErr) console.log("⚠️ profile income fetch error:", profileErr);

      monthlyIncome = safeNumber(profile?.monthly_income, 0);
    } else {
      monthlyIncome = safeNumber(monthlyIncome, 0);
    }

    weeklyIncomeEstimate =
      weeklyIncomeEstimate !== undefined && weeklyIncomeEstimate !== null
        ? safeNumber(
            weeklyIncomeEstimate,
            monthlyIncome > 0 ? monthlyIncome / 4 : 0,
          )
        : monthlyIncome > 0
          ? monthlyIncome / 4
          : 0;

    weeklyExpense = safeNumber(weeklyExpense, 0);

    topSpendCategories = Array.isArray(topSpendCategories)
      ? topSpendCategories
      : [];
    weeklyGoals = Array.isArray(weeklyGoals) ? weeklyGoals : [];

    if (!weeklyGoals.length && weekStartStr) {
      const { data: goals, error: goalsErr } = await supabase
        .from("user_goals")
        .select("title, notes, completed, week_start")
        .eq("user_id", userId)
        .eq("week_start", weekStartStr);

      if (goalsErr) console.log("⚠️ goals fetch error:", goalsErr);
      weeklyGoals = goals || [];
    }

    if (!monthlyIncome && weeklyExpense === 0 && weeklyGoals.length === 0) {
      return res.json({
        success: true,
        insights: [
          "Set your monthly income and scan a few receipts so Fin can personalize insights for you.",
        ],
      });
    }

    const goalsForAI = weeklyGoals.map((g) => ({
      title: g.title,
      notes: g.notes,
      completed: !!g.completed,

      target_rm: extractRMAmount(g.title) ?? extractRMAmount(g.notes),
      week_start: g.week_start,
    }));

    const context = {
      currency: "MYR",
      timeframe: {
        weekStart: weekStartStr ?? null,
        weekEnd: weekEndStr ?? null,
      },
      income: {
        monthly_rm: Number(monthlyIncome.toFixed(2)),
        weekly_estimate_rm: Number(weeklyIncomeEstimate.toFixed(2)),
      },
      spending: {
        weekly_total_rm: Number(weeklyExpense.toFixed(2)),
        top_categories: topSpendCategories.map((c) => ({
          category: c.category,
          amount_rm: Number(safeNumber(c.amount, 0).toFixed(2)),
        })),
      },
      goals: goalsForAI,
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Faster, cheaper, and actually exists!
      messages: [
        {
          role: "user",
          // ✅ FIX 3: For text-only requests, 'content' can just be a standard string
          content:
            "You are Fin, a friendly AI finance coach in a Malaysian student finance app.\n" +
            "Use the user's weekly spending, monthly income, and weekly goals to give PERSONALIZED recommendations.\n\n" +
            "Rules:\n" +
            "- Write 2 bullet-style insights (short sentences, not long paragraphs).\n" +
            "- Be specific with RM amounts from the data.\n" +
            "- If the user reached a savings goal, celebrate. You can be playful, but DO NOT encourage reckless spending.\n" +
            "  (Instead say something like: 'You hit your goal — nice! Keep a small buffer, and you can treat yourself within RMX.')\n" +
            "- If not reached, give 1–2 actionable suggestions tied to their top spending category.\n" +
            "- If monthly income is missing/0, gently ask them to set it.\n" +
            "- Return ONLY valid JSON: an array of strings. No markdown, no extra fields.\n\n" +
            "User data JSON:\n" +
            JSON.stringify(context, null, 2) +
            "\n\nReturn JSON array only like:\n" +
            '["Insight 1", "Insight 2", "Insight 3"]',
        },
      ],
    });

    // ✅ FIX 4: Correctly parse the standard OpenAI response object
    const outputText = response.choices[0]?.message?.content || "";

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
      if (!Array.isArray(insights)) throw new Error("Output is not an array");
      insights = insights
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 5);
    } catch (parseErr) {
      console.error("❌ Failed to parse AI insights JSON:", parseErr, cleaned);
      return res.status(500).json({
        success: false,
        error: "Failed to parse AI insights output",
      });
    }

    // Fallback if AI returns empty
    if (!insights.length) {
      insights = [
        "Fin couldn’t generate insights right now — try again after scanning more receipts.",
      ];
    }

    return res.json({ success: true, insights });
  } catch (err) {
    console.error("💥 /api/fin-insights top-level error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Unexpected server error" });
  }
}
