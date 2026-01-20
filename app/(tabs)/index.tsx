// app/(tabs)/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase"; // adjust if needed

const PRIMARY = "#00D09E";

type WeeklyPoint = {
  label: string;
  total: number;
};

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;

  // Convert to Date objects & sort desc
  const uniqueDates = Array.from(new Set(dates));
  const sorted = uniqueDates
    .map((d) => new Date(d + "T00:00:00"))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    const diffDays = Math.round(
      (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === streak) {
      streak++;
    } else if (diffDays > streak) {
      break;
    }
  }
  return streak;
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]; // 'YYYY-MM-DD'
}

export default function HomeScreen() {
  const router = useRouter();

  const [username, setUsername] = useState<string>("Guest");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(3000);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>(
    Array.from({ length: 7 }, (_, i) => ({
      label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      total: 0,
    })),
  );
  const [monthReceiptCount, setMonthReceiptCount] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [insights, setInsights] = useState<string[]>([]);

  const progressPercent =
    monthlyIncome > 0
      ? Math.min(100, Math.round((totalExpense / monthlyIncome) * 100))
      : 0;

  useEffect(() => {
    const loadData = async () => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const user = authData?.user;

      if (authError || !user) {
        console.log("Home: no user", authError);
        return;
      }

      // 1️⃣ Load profile (username, monthly income, avatar)
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("username, monthy_income, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.log("Home: profile error", profileError);
      } else if (profile) {
        setUsername(profile.username || "User");

        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }

        const incomeNum = parseFloat(profile.monthy_income || "0");
        if (!Number.isNaN(incomeNum) && incomeNum > 0) {
          setMonthlyIncome(incomeNum);
        }
      }

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstOfMonthStr = firstOfMonth.toISOString().split("T")[0];

      // 2️⃣ Load this month's receipts (for total + count)
      const { data: monthReceipts, error: monthError } = await supabase
        .from("receipts")
        .select("total_amount, receipt_date")
        .eq("user_id", user.id)
        .gte("receipt_date", firstOfMonthStr)
        .lte("receipt_date", todayStr);

      if (monthError) {
        console.log("Home: month receipts error", monthError);
      } else if (monthReceipts) {
        const sum = monthReceipts.reduce(
          (acc: number, r: any) => acc + Number(r.total_amount || 0),
          0,
        );
        setTotalExpense(sum);
        setMonthReceiptCount(monthReceipts.length);
      }

      // 3️⃣ Load last 7 days receipts for chart
      const start = new Date(today);
      start.setDate(today.getDate() - 6); // 6 days before today
      const startStr = start.toISOString().split("T")[0];

      const { data: weekReceipts, error: weekError } = await supabase
        .from("receipts")
        .select("total_amount, receipt_date")
        .eq("user_id", user.id)
        .gte("receipt_date", startStr)
        .lte("receipt_date", todayStr);

      if (weekError) {
        console.log("Home: week receipts error", weekError);
      } else {
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const points: WeeklyPoint[] = [];

        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const label = dayNames[d.getDay()];
          const keyStr = d.toISOString().split("T")[0];

          const totalForDay = (weekReceipts || [])
            .filter((r: any) => r.receipt_date === keyStr)
            .reduce(
              (acc: number, r: any) => acc + Number(r.total_amount || 0),
              0,
            );

          points.push({ label, total: totalForDay });
        }

        setWeeklyData(points);
      }

      // 4️⃣ Load streaks
      const { data: streakRows, error: streakError } = await supabase
        .from("user_streaks")
        .select("date")
        .eq("user_id", user.id);

      if (streakError) {
        console.log("Home: streak error", streakError);
      } else if (streakRows) {
        const dates = streakRows.map((r: any) => r.date as string);
        setStreakCount(computeStreak(dates));
      }

      // 5️⃣ Load last 14 days receipts for category-based insights
      const fourteenDaysAgoStr = getDateNDaysAgo(13); // 14 days inclusive

      const { data: insightReceipts, error: insightError } = await supabase
        .from("receipts")
        .select("total_amount, category, receipt_date")
        .eq("user_id", user.id)
        .gte("receipt_date", fourteenDaysAgoStr)
        .lte("receipt_date", todayStr);

      if (insightError) {
        console.log("Home: insight receipts error", insightError);
        setInsights([]);
      } else if (insightReceipts) {
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay()); // Sunday = 0
        startOfThisWeek.setHours(0, 0, 0, 0);

        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const thisWeekByCat: Record<string, number> = {};
        const lastWeekByCat: Record<string, number> = {};
        let thisWeekTotal = 0;
        let lastWeekTotal = 0;

        (insightReceipts || []).forEach((row: any) => {
          const date = new Date(row.receipt_date);
          const amount = Number(row.total_amount) || 0;
          const cat = (row.category || "OTHER") as string;

          if (date >= startOfThisWeek) {
            thisWeekByCat[cat] = (thisWeekByCat[cat] || 0) + amount;
            thisWeekTotal += amount;
          } else if (date >= startOfLastWeek && date < startOfThisWeek) {
            lastWeekByCat[cat] = (lastWeekByCat[cat] || 0) + amount;
            lastWeekTotal += amount;
          }
        });

        const newInsights: string[] = [];

        // 🏅 Top category this week
        let topCategory: string | null = null;
        let topAmount = 0;
        for (const cat in thisWeekByCat) {
          if (thisWeekByCat[cat] > topAmount) {
            topAmount = thisWeekByCat[cat];
            topCategory = cat;
          }
        }
        if (topCategory) {
          newInsights.push(
            `🏅 Highest spending this week: ${topCategory
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())} (RM${topAmount.toFixed(
              2,
            )}).`,
          );
        }

        // 📊 Week-over-week total change
        if (lastWeekTotal > 0) {
          const diff = thisWeekTotal - lastWeekTotal;
          const pct = Math.round((diff / lastWeekTotal) * 100);

          if (pct > 0) {
            newInsights.push(
              `📈 Your total spending is up ${pct}% compared to last week.`,
            );
          } else if (pct < 0) {
            newInsights.push(
              `📉 Your total spending is down ${Math.abs(
                pct,
              )}% compared to last week. Nice job!`,
            );
          } else {
            newInsights.push(
              `⚖️ Your spending is about the same as last week.`,
            );
          }
        } else if (thisWeekTotal > 0) {
          newInsights.push(
            `🆕 You started tracking this week with RM${thisWeekTotal.toFixed(
              2,
            )} recorded.`,
          );
        }

        setInsights(newInsights);
      }
    };

    loadData();
  }, []);

  const maxWeekly = Math.max(...weeklyData.map((p) => p.total), 1);

  const totalLast7Days = weeklyData.reduce((acc, p) => acc + p.total, 0);

  // Simple "AI-ish" suggestion text
  let suggestion = "Keep tracking your spending to build better habits.";
  if (progressPercent >= 80) {
    suggestion =
      "You’ve used most of your monthly income. Try slowing down non-essential spending.";
  } else if (progressPercent >= 50) {
    suggestion =
      "You’re halfway through your income this month. Review your receipts to stay on track.";
  } else if (progressPercent > 0 && progressPercent < 50) {
    suggestion =
      "Nice! Your spending is under 50% of your income. Keep saving consistently.";
  }

  // Simple badges derived from data
  const badges = [
    {
      id: "first-receipt",
      title: "Receipt Rookie",
      description: "Scan your first receipt.",
      unlocked: monthReceiptCount >= 1,
    },
    {
      id: "weekly-streak",
      title: "Streak Starter",
      description: "Keep a streak of 3 days.",
      unlocked: streakCount >= 3,
    },
    {
      id: "budget-guardian",
      title: "Budget Guardian",
      description: "Stay under 50% of your income this month.",
      unlocked: progressPercent > 0 && progressPercent <= 50,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* ===== Top Green Header ===== */}
      <View style={styles.header}>
        {/* Greeting */}
        <View>
          <Text style={styles.greetingTitle}>Hi, {username}</Text>
          <Text style={styles.greetingSubtitle}>
            Let&apos;s improve your finances today
          </Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => router.push("/profile")}
        >
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%", borderRadius: 999 }}
              />
            ) : (
              <Ionicons name="person-outline" size={20} color={PRIMARY} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Income / Expense Row */}
      <View style={styles.statsRow}>
        <View className="statBox" style={styles.statBox}>
          <View style={styles.statLabelRow}>
            <Ionicons name="calendar-outline" size={16} color="#052224" />
            <Text style={styles.statLabel}>Monthly Income</Text>
          </View>
          <Text style={styles.incomeValue}>RM{monthlyIncome.toFixed(2)}</Text>
        </View>

        <View style={[styles.statBox, styles.statBoxRight]}>
          <View style={styles.statLabelRow}>
            <Ionicons name="card-outline" size={16} color="#052224" />
            <Text style={styles.statLabel}>Total Expense</Text>
          </View>
          <Text style={styles.expenseValue}>RM{totalExpense.toFixed(2)}</Text>
        </View>
      </View>

      {/* Progress Bar & Status */}
      <View style={styles.progressWrapper}>
        <View style={styles.progressBarBackground}>
          <View
            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={styles.progressPercentText}>{progressPercent}%</Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons name="checkmark-circle" size={16} color="#052224" />
        <Text style={styles.statusText}>
          You&apos;re on track this month. Good Job
        </Text>
      </View>

      {/* ===== White Rounded Content Area ===== */}
      <View style={styles.bottomSheet}>
        {/* CTA Buttons */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 65 }}
        >
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push("/chatbot")}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color="#093030"
              />
              <Text style={styles.ctaText}>Ask Fin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push("/receiptscanner")}
            >
              <Ionicons name="receipt-outline" size={22} color="#093030" />
              <Text style={styles.ctaText}>Scan Receipt</Text>
            </TouchableOpacity>
          </View>
          {/* Section Title */}
          <Text style={styles.sectionTitle}>
            Your Spending Pattern Based On The{"\n"}Last 7 Days
          </Text>
          {/* Chart Card */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>Income &amp; Expenses</Text>
              <View style={styles.chartIconBubble}>
                <Ionicons name="calendar-outline" size={18} color="#093030" />
              </View>
            </View>
            {/* Simple bar chart for weekly expenses */}
            <View style={styles.chartBody}>
              {weeklyData.map((point, idx) => {
                const height =
                  maxWeekly > 0
                    ? 20 + (80 * point.total) / maxWeekly // 20–100
                    : 20;
                return (
                  <View key={idx} style={styles.barWrapper}>
                    <View style={[styles.bar, { height }]} />
                    <Text style={styles.barLabel}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
            {/* Total last 7 days */}
            <Text style={styles.chartSummaryText}>
              Last 7 days expenses: RM{totalLast7Days.toFixed(2)}
            </Text>
          </View>
          {/* ===== Insights Section ===== */}
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>Smart Insight</Text>
            <Text style={styles.insightsText}>{suggestion}</Text>

            {insights.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {insights.map((line, index) => (
                  <Text key={index} style={styles.insightsText}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
          </View>
          {/* ===== Streak Summary & Badges ===== */}
          <View style={styles.streakRow}>
            <View>
              <Text style={styles.streakLabel}>Daily Streak</Text>
              <Text style={styles.streakValue}>
                {streakCount} day{streakCount === 1 ? "" : "s"}
              </Text>
            </View>
            <View>
              <Text style={styles.streakLabel}>Receipts this month</Text>
              <Text style={styles.streakValue}>{monthReceiptCount}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            {badges.map((b) => (
              <View
                key={b.id}
                style={[
                  styles.badgeCard,
                  b.unlocked ? styles.badgeUnlocked : styles.badgeLocked,
                ]}
              >
                <Ionicons
                  name={b.unlocked ? "trophy" : "lock-closed"}
                  size={18}
                  color={b.unlocked ? "#F4B000" : "#7A8B8B"}
                />
                <Text
                  style={[
                    styles.badgeTitle,
                    !b.unlocked && { color: "#7A8B8B" },
                  ]}
                >
                  {b.title}
                </Text>
                <Text
                  style={[
                    styles.badgeDescription,
                    !b.unlocked && { color: "#7A8B8B" },
                  ]}
                >
                  {b.description}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ===== Styles ===== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },

  /* Header */
  header: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingTitle: {
    color: "#052224",
    fontSize: 20,
    fontWeight: "700",
  },
  greetingSubtitle: {
    color: "#052224",
    fontSize: 13,
    marginTop: 4,
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  /* Stats Row */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  statBoxRight: {
    marginRight: 0,
    marginLeft: 8,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    color: "#052224",
    fontSize: 11,
  },
  incomeValue: {
    marginTop: 6,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  expenseValue: {
    marginTop: 6,
    color: "#0068FF",
    fontSize: 18,
    fontWeight: "800",
  },

  /* Progress & Status */
  progressWrapper: {
    marginTop: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  progressBarBackground: {
    flex: 1,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    marginRight: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#000000",
    borderRadius: 999,
  },
  progressPercentText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
  },
  statusText: {
    color: "#052224",
    fontSize: 12,
  },

  /* Bottom sheet */
  bottomSheet: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },

  /* CTAs */
  ctaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  ctaButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#093030",
  },

  sectionTitle: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#093030",
    marginBottom: 16,
  },

  /* Chart card */
  chartCard: {
    backgroundColor: "#E9FFF4",
    borderRadius: 26,
    padding: 16,
  },
  chartHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#093030",
  },
  chartIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#C7F2D9",
    justifyContent: "center",
    alignItems: "center",
  },

  chartBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
  },
  barWrapper: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    width: 10,
    borderRadius: 6,
    backgroundColor: "#00A2FF",
  },
  barLabel: {
    fontSize: 10,
    color: "#093030",
    marginTop: 4,
  },
  chartSummaryText: {
    marginTop: 10,
    fontSize: 12,
    color: "#093030",
  },

  /* Insights */
  insightsCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#F4FBF7",
  },
  insightsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#093030",
    marginBottom: 4,
  },
  insightsText: {
    fontSize: 12,
    color: "#3B4B4B",
  },

  /* Streak & Badges */
  streakRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streakLabel: {
    fontSize: 12,
    color: "#4A5B5B",
  },
  streakValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#093030",
  },

  badgeRow: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "space-between",
  },
  badgeCard: {
    flex: 1,
    borderRadius: 16,
    padding: 10,
    marginHorizontal: 3,
  },
  badgeUnlocked: {
    backgroundColor: "#FFF7DA",
  },
  badgeLocked: {
    backgroundColor: "#E6ECEC",
  },
  badgeTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#093030",
  },
  badgeDescription: {
    fontSize: 11,
    color: "#3B4B4B",
    marginTop: 2,
  },
});
