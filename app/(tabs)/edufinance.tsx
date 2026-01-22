import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";

const PRIMARY = "#00D09E";
const CARD_BG = "#E9FFF4";

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;

  // Sort newest → oldest
  const sorted = [...dates].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);

    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
    } else {
      break; // gap → streak stops
    }
  }

  return streak;
}

function getWeekKey(date = new Date()) {
  // ISO week number
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  const paddedWeek = weekNo.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-W${paddedWeek}`; // e.g. "2026-W03"
}

const BADGE_CONFIG: Record<string, { emoji: string; labelOverride?: string }> =
  {
    streak_1: { emoji: "✨" },
    streak_3: { emoji: "🔥" },
    streak_7: { emoji: "🏅" },
    streak_30: { emoji: "🏆" },

    savings_novice: { emoji: "💰" },
    savings_pro: { emoji: "🏦" },
    savings_master: { emoji: "🌈" },

    budget_novice: { emoji: "📊" },
    budget_pro: { emoji: "📈" },
    budget_master: { emoji: "💼" },

    debt_novice: { emoji: "💳" },
    debt_pro: { emoji: "📉" },
    debt_master: { emoji: "🧾" },

    scanner_first: { emoji: "🧾" },
    scanner_10: { emoji: "🧮" },
    scanner_50: { emoji: "📚" },

    foodie: { emoji: "🍔" },
    groceries_hero: { emoji: "🛒" },

    under_budget: { emoji: "📉" },
    super_saver: { emoji: "💎" },
    spender: { emoji: "💸" },

    fin_fan: { emoji: "🤖" },
    fin_superfan: { emoji: "🌟" },
  };

const TOTAL_BADGES = Object.keys(BADGE_CONFIG).length;
const PREVIEW_BADGE_COUNT = 2;

type Goal = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  week_start: string; // "YYYY-MM-DD"
  completed: boolean;
  created_at: string;
};

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // Sun=0 ... Sat=6
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODateOnly(d: Date) {
  // returns YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function EduFinanceScreen() {
  const [savingsCompleted, setSavingsCompleted] = useState(0);
  const [budgetingCompleted, setBudgetingCompleted] = useState(0);
  const [debtCompleted, setDebtCompleted] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const router = useRouter();
  const [isBadgeModalVisible, setBadgeModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalNotes, setNewGoalNotes] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);

  const [badges, setBadges] = useState<
    {
      badge_code: string;
      badge_name: string;
      badge_description: string | null;
    }[]
  >([]);

  const previewBadges = badges.slice(0, PREVIEW_BADGE_COUNT);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    toISODateOnly(getMonday(new Date())),
  );

  const loadGoals = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { data, error } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user.id)
      .gte("week_start", toISODateOnly(monthStart))
      .lt("week_start", toISODateOnly(monthEnd))
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.log("loadGoals error:", error.message);
      return;
    }

    setGoals((data as Goal[]) || []);
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const addGoal = useCallback(async () => {
    const title = newGoalTitle.trim();
    const notes = newGoalNotes.trim();
    if (!title) return;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const payload = {
      user_id: user.id,
      title,
      notes: notes ? notes : null,
      week_start: selectedWeekStart, // weekly goal
      completed: false,
    };

    const { data, error } = await supabase
      .from("user_goals")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.log("addGoal error:", error.message);
      return;
    }

    // add new goal on top
    setGoals((prev) => [data as Goal, ...prev]);
    setNewGoalTitle("");
    setNewGoalNotes("");
    setGoalModalVisible(false);
  }, [newGoalTitle, newGoalNotes, selectedWeekStart]);

  const toggleGoal = useCallback(async (goal: Goal) => {
    const nextCompleted = !goal.completed;

    // Optimistic UI
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id ? { ...g, completed: nextCompleted } : g,
      ),
    );

    const { error } = await supabase
      .from("user_goals")
      .update({ completed: nextCompleted })
      .eq("id", goal.id);

    if (error) {
      console.log("toggleGoal error:", error.message);
      // rollback if failed
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goal.id ? { ...g, completed: goal.completed } : g,
        ),
      );
    }
  }, []);

  const loadBadges = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      console.log("No user for badges:", authError);
      setBadges([]);
      return;
    }

    const { data, error } = await supabase
      .from("user_badges")
      .select("badge_code, badge_name, badge_description")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: true });

    if (error) {
      console.log("Error loading badges:", error);
      setBadges([]);
      return;
    }

    setBadges(data || []);
  }, []);

  const checkAndAwardStreakBadges = useCallback(
    async (streak: number) => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const user = authData?.user;

      if (authError || !user) {
        console.log("No user for badge award:", authError);
        return;
      }

      // Get existing badge codes for this user
      const { data: existing, error: existingError } = await supabase
        .from("user_badges")
        .select("badge_code")
        .eq("user_id", user.id);

      if (existingError) {
        console.log("Error checking existing badges:", existingError);
        return;
      }

      const owned = new Set((existing || []).map((b) => b.badge_code));

      const toInsert: {
        user_id: string;
        badge_code: string;
        badge_name: string;
        badge_description?: string;
      }[] = [];

      // First streak day
      if (streak >= 1 && !owned.has("streak_1")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "streak_1",
          badge_name: "First Step",
          badge_description: "Completed your first daily EduFinance task.",
        });
      }

      // 3-day streak
      if (streak >= 3 && !owned.has("streak_3")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "streak_3",
          badge_name: "Beginner Saver",
          badge_description: "Maintained a 3-day learning streak.",
        });
      }

      // 7-day streak
      if (streak >= 7 && !owned.has("streak_7")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "streak_7",
          badge_name: "Money Habit",
          badge_description: "Maintained a 7-day learning streak.",
        });
      }

      // 30-day streak
      if (streak >= 30 && !owned.has("streak_30")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "streak_30",
          badge_name: "Financial Master",
          badge_description: "Maintained a 30-day learning streak.",
        });
      }

      if (toInsert.length === 0) return;

      const { error: insertError } = await supabase
        .from("user_badges")
        .insert(toInsert);

      if (insertError) {
        console.log("Error inserting streak badges:", insertError);
        return;
      }

      console.log(
        "🏆 New streak badges earned:",
        toInsert.map((b) => b.badge_code),
      );

      // refresh local list
      loadBadges();
    },
    [loadBadges],
  );

  const checkAndAwardTaskBadges = useCallback(
    async (savingsCount: number, budgetingCount: number, debtCount: number) => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const user = authData?.user;

      if (authError || !user) {
        console.log("No user for task badges:", authError);
        return;
      }

      // 1️⃣ Get existing badge codes for this user
      const { data: existing, error: existingError } = await supabase
        .from("user_badges")
        .select("badge_code")
        .eq("user_id", user.id);

      if (existingError) {
        console.log("Error checking existing task badges:", existingError);
        return;
      }

      const owned = new Set((existing || []).map((b) => b.badge_code));
      const toInsert: {
        user_id: string;
        badge_code: string;
        badge_name: string;
        badge_description?: string;
      }[] = [];

      // 💰 Savings badges
      if (savingsCount >= 3 && !owned.has("savings_novice")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "savings_novice",
          badge_name: "Savings Starter",
          badge_description: "Completed 3 savings exercises.",
        });
      }
      if (savingsCount >= 6 && !owned.has("savings_pro")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "savings_pro",
          badge_name: "Savings Pro",
          badge_description: "Completed 6 savings exercises.",
        });
      }
      if (savingsCount >= 9 && !owned.has("savings_master")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "savings_master",
          badge_name: "Savings Master",
          badge_description: "Completed 9 savings exercises.",
        });
      }

      // 📊 Budgeting badges
      if (budgetingCount >= 3 && !owned.has("budget_novice")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "budget_novice",
          badge_name: "Budget Rookie",
          badge_description: "Completed 3 budgeting exercises.",
        });
      }
      if (budgetingCount >= 6 && !owned.has("budget_pro")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "budget_pro",
          badge_name: "Budget Planner",
          badge_description: "Completed 6 budgeting exercises.",
        });
      }
      if (budgetingCount >= 9 && !owned.has("budget_master")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "budget_master",
          badge_name: "Budget Strategist",
          badge_description: "Completed 9 budgeting exercises.",
        });
      }

      // 💳 Debt badges
      if (debtCount >= 3 && !owned.has("debt_novice")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "debt_novice",
          badge_name: "Debt Aware",
          badge_description: "Completed 3 debt management exercises.",
        });
      }
      if (debtCount >= 6 && !owned.has("debt_pro")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "debt_pro",
          badge_name: "Debt Fighter",
          badge_description: "Completed 6 debt management exercises.",
        });
      }
      if (debtCount >= 9 && !owned.has("debt_master")) {
        toInsert.push({
          user_id: user.id,
          badge_code: "debt_master",
          badge_name: "Debt Free Mindset",
          badge_description: "Completed 9 debt management exercises.",
        });
      }

      if (toInsert.length === 0) return;

      const { error: insertError } = await supabase
        .from("user_badges")
        .insert(toInsert);

      if (insertError) {
        console.log("Error inserting task badges:", insertError);
        return;
      }

      console.log(
        "🏆 New task badges earned:",
        toInsert.map((b) => b.badge_code),
      );

      // refresh list so UI shows new badges + progress
      loadBadges();
    },
    [loadBadges],
  );

  // 🔹 1. Load completion counts
  const loadCompletionCounts = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      console.log("No user for completion counts:", authError);
      setSavingsCompleted(0);
      setBudgetingCompleted(0);
      setDebtCompleted(0);
      return;
    }

    const weekKey = getWeekKey();

    const fetchCount = async (category: string) => {
      const { data, error } = await supabase
        .from("edufinance_task_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_key", weekKey)
        .eq("category", category);

      if (error) {
        console.log(`Error loading ${category} completion:`, error);
        return 0;
      }

      return data?.length ?? 0;
    };

    const [savingsCount, budgetingCount, debtCount] = await Promise.all([
      fetchCount("savings"),
      fetchCount("budgeting"),
      fetchCount("debt"),
    ]);

    setSavingsCompleted(savingsCount);
    setBudgetingCompleted(budgetingCount);
    setDebtCompleted(debtCount);

    await checkAndAwardTaskBadges(savingsCount, budgetingCount, debtCount);
  }, [checkAndAwardTaskBadges]);

  // 🔹 2. Load streak count
  const loadStreak = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      console.log("No user for streak:", authError);
      setStreakCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("user_streaks")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (error) {
      console.log("Error loading streaks:", error);
      setStreakCount(0);
      return;
    }

    const dates = (data || []).map((row) => row.date as string);
    const streak = computeStreak(dates);
    setStreakCount(streak);

    checkAndAwardStreakBadges(streak);
  }, [checkAndAwardStreakBadges, checkAndAwardTaskBadges]);

  // 🔹 3. useFocusEffect: run both whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      loadCompletionCounts();
      loadStreak();
      loadBadges();
    }, [
      loadCompletionCounts,
      loadStreak,
      loadBadges,
      checkAndAwardTaskBadges,
      checkAndAwardStreakBadges,
    ]),
  );

  const unlockedBadgeCount = badges.filter(
    (b) => !!BADGE_CONFIG[b.badge_code],
  ).length;

  const badgeProgress =
    TOTAL_BADGES > 0 ? (unlockedBadgeCount / TOTAL_BADGES) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color="#052224" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EduFinance</Text>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="#052224" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.innerContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Create A Streak Going!</Text>
            <TaskCard
              title="Streaks!"
              description={
                streakCount > 0
                  ? `Current streak: ${streakCount} day${streakCount > 1 ? "s" : ""}`
                  : "Complete at least 1 task today to start your streak!"
              }
              image={require("../../assets/images/fire flame-png 1.png")}
              multiline
              imageStyle={{ width: 40, height: 40 }}
              showCircle={false}
            />

            {badges.length > 0 && (
              <>
                <View style={styles.badgeHeaderRow}>
                  <Text style={styles.sectionTitle}>Badges Earned</Text>
                  <TouchableOpacity onPress={() => setBadgeModalVisible(true)}>
                    <Text style={styles.viewAllText}>View all</Text>
                  </TouchableOpacity>
                </View>

                {/* 🔹 Progress summary */}
                <Text style={styles.badgeProgressText}>
                  {unlockedBadgeCount} / {TOTAL_BADGES} badges unlocked
                </Text>
                <View style={styles.badgeProgressBar}>
                  <View
                    style={[
                      styles.badgeProgressFill,
                      { width: `${badgeProgress}%` },
                    ]}
                  />
                </View>

                <View style={styles.badgeRow}>
                  {previewBadges.map((badge) => {
                    const meta = BADGE_CONFIG[badge.badge_code] || {
                      emoji: "🏆",
                    };
                    return (
                      <View key={badge.badge_code} style={styles.badgePill}>
                        <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
                        <View style={{ marginLeft: 6 }}>
                          <Text style={styles.badgeName}>
                            {badge.badge_name}
                          </Text>
                          {badge.badge_description ? (
                            <Text style={styles.badgeDescription}>
                              {badge.badge_description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <View style={{ marginTop: 18 }}>
              <View style={styles.goalHeaderRow}>
                <Text style={styles.sectionTitle}>Goals</Text>

                <TouchableOpacity
                  style={styles.setGoalsBtn}
                  onPress={() => setGoalModalVisible(true)}
                >
                  <Text style={styles.setGoalsBtnText}>Set your goals</Text>
                </TouchableOpacity>
              </View>

              {goals.length === 0 ? (
                <Text style={styles.goalEmptyText}>
                  No goals yet. Set one to start building better habits 💪
                </Text>
              ) : (
                <View style={styles.goalList}>
                  {goals.map((goal) => (
                    <TouchableOpacity
                      key={goal.id}
                      style={[
                        styles.goalCard,
                        goal.completed && styles.goalCardCompleted,
                      ]}
                      onPress={() => toggleGoal(goal)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.goalCardLeft}>
                        <View
                          style={[
                            styles.goalCheck,
                            goal.completed && styles.goalCheckOn,
                          ]}
                        >
                          {goal.completed ? (
                            <Text style={styles.goalCheckMark}>✓</Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.goalCardBody}>
                        <Text
                          style={[
                            styles.goalTitle,
                            goal.completed && styles.goalTitleCompleted,
                          ]}
                        >
                          {goal.title}
                        </Text>

                        <Text style={styles.goalWeekText}>
                          Week of {goal.week_start}
                        </Text>

                        {goal.notes ? (
                          <Text
                            style={[
                              styles.goalNotes,
                              goal.completed && styles.goalNotesCompleted,
                            ]}
                          >
                            {goal.notes}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Modal
              visible={goalModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setGoalModalVisible(false)}
            >
              <View style={styles.goalModalOverlay}>
                <View style={styles.goalModalCard}>
                  <Text style={styles.goalModalTitle}>Set a new goal</Text>

                  <TextInput
                    value={newGoalTitle}
                    onChangeText={setNewGoalTitle}
                    placeholder="Goal title (e.g., Save RM200)"
                    style={styles.goalModalInput}
                    placeholderTextColor="#9CA3AF"
                  />

                  <TextInput
                    value={newGoalNotes}
                    onChangeText={setNewGoalNotes}
                    placeholder="Notes (optional)"
                    style={[styles.goalModalInput, { height: 80 }]}
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />

                  <View style={styles.goalModalBtnRow}>
                    <TouchableOpacity
                      style={[styles.goalModalBtn, styles.goalModalBtnGhost]}
                      onPress={() => setGoalModalVisible(false)}
                    >
                      <Text style={styles.goalModalBtnGhostText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.goalModalBtn}
                      onPress={addGoal}
                    >
                      <Text style={styles.goalModalBtnText}>Add goal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <Text style={styles.subtitle}>Lets Do Some Exercises</Text>

            <Text style={styles.sectionTitle}>Savings</Text>
            <TaskCard
              title="Savings Task"
              description={`Completed ${savingsCompleted}/3`}
              image={require("../../assets/images/safe box.png")}
              onPress={() =>
                router.push({
                  pathname: "/edufinance-quiz",
                  params: { category: "savings" },
                })
              }
            />

            <Text style={styles.sectionTitle}>Budgeting</Text>
            <TaskCard
              title="Budgeting Task"
              description={`Completed ${budgetingCompleted}/3`}
              image={require("../../assets/images/wallet with cash.png")}
              onPress={() =>
                router.push({
                  pathname: "/edufinance-quiz",
                  params: { category: "budgeting" },
                })
              }
            />

            <Text style={styles.sectionTitle}>Debt Management</Text>
            <TaskCard
              title="Debt Task"
              description={`Completed ${debtCompleted}/3`}
              image={require("../../assets/images/credit card.png")}
              onPress={() =>
                router.push({
                  pathname: "/edufinance-quiz",
                  params: { category: "debt" },
                })
              }
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={isBadgeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBadgeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Badges</Text>
              <TouchableOpacity
                onPress={() => setBadgeModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#052224" />
              </TouchableOpacity>
            </View>

            {badges.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyEmoji}>🏅</Text>
                <Text style={styles.modalEmptyTitle}>No badges yet</Text>
                <Text style={styles.modalEmptyText}>
                  Complete EduFinance exercises and keep your streak going to
                  earn badges.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalBadgeGrid}>
                  {badges.map((badge) => {
                    const meta = BADGE_CONFIG[badge.badge_code] || {
                      emoji: "🏆",
                    };
                    return (
                      <View
                        key={badge.badge_code}
                        style={styles.modalBadgeCard}
                      >
                        <Text style={styles.modalBadgeEmoji}>{meta.emoji}</Text>
                        <Text style={styles.modalBadgeName}>
                          {badge.badge_name}
                        </Text>
                        {badge.badge_description ? (
                          <Text style={styles.modalBadgeDescription}>
                            {badge.badge_description}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type TaskCardProps = {
  title: string;
  description: string;
  image: any;
  imageStyle?: any;
  multiline?: boolean;
  showCircle?: boolean;
  onPress?: () => void;
};

const TaskCard: React.FC<TaskCardProps> = ({
  title,
  description,
  multiline,
  image,
  imageStyle,
  showCircle = true,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.imageWrapper}>
          <Image source={image} style={[styles.cardImage, imageStyle]} />
        </View>

        <View style={styles.cardTextContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text
            style={[styles.cardDescription, multiline && { width: "90%" }]}
            numberOfLines={multiline ? 3 : 1}
          >
            {description}
          </Text>
        </View>

        {showCircle ? (
          <View style={styles.arrowWrapper}>
            <Ionicons name="chevron-forward" size={20} color="#2F80ED" />
          </View>
        ) : (
          <View style={styles.circleSpacer} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#052224",
    fontSize: 18,
    fontWeight: "700",
  },
  innerContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#0E3E3E",
    marginBottom: 24,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0E3E3E",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  imageWrapper: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16302A",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: "#6B7A7A",
  },
  cardImage: {
    width: 80,
    height: 80,
    resizeMode: "cover",
  },
  circleSpacer: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
  arrowWrapper: {
    width: 24,
    height: 24,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9FFF4",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16302A",
  },
  badgeDescription: {
    fontSize: 10,
    color: "#4A5B5B",
  },
  badgeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 6,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2F80ED",
  },
  badgeProgressText: {
    fontSize: 11,
    color: "#4A5B5B",
    marginBottom: 4,
  },
  badgeProgressBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E3EBEB",
    overflow: "hidden",
    marginBottom: 10,
  },
  badgeProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#00D09E", // same PRIMARY green
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#052224",
  },
  modalScrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  modalBadgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  modalBadgeCard: {
    width: "48%",
    backgroundColor: "#E9FFF4",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  modalBadgeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  modalBadgeName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16302A",
    textAlign: "center",
    marginBottom: 4,
  },
  modalBadgeDescription: {
    fontSize: 11,
    color: "#4A5B5B",
    textAlign: "center",
  },
  modalEmptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  modalEmptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  modalEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16302A",
    marginBottom: 4,
  },
  modalEmptyText: {
    fontSize: 12,
    color: "#4A5B5B",
    textAlign: "center",
  },
  moreBadgesText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
  },
  goalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  setGoalsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#00D09E",
  },

  setGoalsBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  goalEmptyText: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 6,
  },

  goalList: {
    gap: 10,
  },

  goalCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },

  goalCardCompleted: {
    opacity: 0.75,
  },

  goalCardLeft: {
    marginRight: 10,
    justifyContent: "center",
  },

  goalCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },

  goalCheckOn: {
    borderColor: "#16A34A",
    backgroundColor: "#16A34A",
  },

  goalCheckMark: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    marginTop: -1,
  },

  goalCardBody: {
    flex: 1,
  },

  goalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  goalTitleCompleted: {
    textDecorationLine: "line-through",
    color: "#6B7280",
  },

  goalNotes: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  goalNotesCompleted: {
    textDecorationLine: "line-through",
  },

  /* Modal */
  goalModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 18,
  },

  goalModalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },

  goalModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    color: "#111827",
  },

  goalModalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    marginBottom: 10,
  },

  goalModalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },

  goalModalBtn: {
    backgroundColor: "#00D09E",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  goalModalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  goalModalBtnGhost: {
    backgroundColor: "#F3F4F6",
  },

  goalModalBtnGhostText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 13,
  },
  goalWeekText: {
    marginTop: 2,
    fontSize: 11,
    color: "#9CA3AF",
  },
});
