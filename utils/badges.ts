import { supabase } from "./supabase";

type BadgeInput = { code: string; name: string; desc: string };

export async function awardBadgesIfNeeded(badgeList: BadgeInput[]) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return [];

  const { data: ownedData } = await supabase
    .from("user_badges")
    .select("badge_code")
    .eq("user_id", user.id);

  const owned = new Set((ownedData || []).map((b) => b.badge_code));

  const toInsert = badgeList
    .filter((b) => !owned.has(b.code))
    .map((b) => ({
      user_id: user.id,
      badge_code: b.code,
      badge_name: b.name,
      badge_description: b.desc,
    }));

  if (toInsert.length === 0) return [];

  const { error } = await supabase.from("user_badges").insert(toInsert);

  if (error) {
    console.log("Badge insert failed:", error);
    return [];
  }

  console.log(
    "🎉 Awarded badges:",
    toInsert.map((b) => b.badge_code),
  );
  return toInsert;
}

export async function awardScannerBadges(receiptCount: number) {
  const toAward: BadgeInput[] = [];

  if (receiptCount >= 1) {
    toAward.push({
      code: "scanner_first",
      name: "First Receipt",
      desc: "Scanned your first receipt!",
    });
  }
  if (receiptCount >= 10) {
    toAward.push({
      code: "scanner_10",
      name: "Receipt Collector",
      desc: "Scanned 10 receipts!",
    });
  }
  if (receiptCount >= 50) {
    toAward.push({
      code: "scanner_50",
      name: "Receipt Master",
      desc: "Scanned 50 receipts!",
    });
  }

  return awardBadgesIfNeeded(toAward);
}

export async function awardCategoryBadges(
  categoryTotals: Record<string, number>,
) {
  const toAward: BadgeInput[] = [];

  if ((categoryTotals["FOOD_AND_DRINK"] || 0) >= 200) {
    toAward.push({
      code: "foodie",
      name: "Foodie",
      desc: "Spent RM200+ on food!",
    });
  }

  if ((categoryTotals["GROCERIES"] || 0) >= 200) {
    toAward.push({
      code: "groceries_hero",
      name: "Groceries Hero",
      desc: "Spent RM200+ on groceries!",
    });
  }

  return awardBadgesIfNeeded(toAward);
}

export async function awardBudgetBehaviorBadges(
  monthlyExpense: number,
  monthlyIncome: number,
) {
  if (!monthlyIncome || monthlyIncome <= 0) return [];

  const pct = monthlyExpense / monthlyIncome;
  const toAward: BadgeInput[] = [];

  if (pct <= 0.5) {
    toAward.push({
      code: "under_budget",
      name: "Under Budget",
      desc: "Stayed under 50% of your income this month!",
    });
  }

  if (pct <= 0.3) {
    toAward.push({
      code: "super_saver",
      name: "Super Saver",
      desc: "Stayed under 30% of your income this month!",
    });
  }

  if (pct >= 1.2) {
    toAward.push({
      code: "spender",
      name: "Spender",
      desc: "Exceeded income by 20% this month!",
    });
  }

  return awardBadgesIfNeeded(toAward);
}

export async function awardFinEngagementBadges(messageCount: number) {
  const toAward: BadgeInput[] = [];

  if (messageCount >= 5) {
    toAward.push({
      code: "fin_fan",
      name: "Fin Fan",
      desc: "Chatted with Fin 5 times!",
    });
  }

  if (messageCount >= 20) {
    toAward.push({
      code: "fin_superfan",
      name: "Fin Superfan",
      desc: "Chatted with Fin 20+ times!",
    });
  }

  return awardBadgesIfNeeded(toAward);
}
