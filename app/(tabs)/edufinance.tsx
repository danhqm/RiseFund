import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../utils/supabase";



const PRIMARY = "#00D09E";
const CARD_BG = "#E9FFF4";

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;

  // Sort newest → oldest
  const sorted = [...dates].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  let streak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);

    const diffDays =
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);

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
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  const paddedWeek = weekNo.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-W${paddedWeek}`; // e.g. "2026-W03"
}

const BADGE_CONFIG: Record<
  string,
  { emoji: string; labelOverride?: string }
> = {
  streak_1: { emoji: "✨" },
  streak_3: { emoji: "🔥" },
  streak_7: { emoji: "🏅" },
  streak_30: { emoji: "🏆" },
};

export default function EduFinanceScreen() {
  const [savingsCompleted, setSavingsCompleted] = useState(0);
  const [budgetingCompleted, setBudgetingCompleted] = useState(0);
  const [debtCompleted, setDebtCompleted] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const router = useRouter();

  const [badges, setBadges] = useState<
    { badge_code: string; badge_name: string; badge_description: string | null }[]
  >([]);

  const loadBadges = useCallback(async () => {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();
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
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();
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
        console.log("Error inserting badges:", insertError);
        return;
      }

      console.log("🏆 New badges earned:", toInsert.map((b) => b.badge_code));

      // Refresh local list
      loadBadges();
    },
    [loadBadges]
  );

  // 🔹 1. Load completion counts
  const loadCompletionCounts = useCallback(async () => {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();
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
  }, []);

  // 🔹 2. Load streak count
  const loadStreak = useCallback(async () => {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();
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

  }, [checkAndAwardStreakBadges]);

  // 🔹 3. useFocusEffect: run both whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      loadCompletionCounts();
      loadStreak();
    }, [loadCompletionCounts, loadStreak, loadBadges])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EduFinance</Text>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="#ffffff" />
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
            <Text style={styles.subtitle}>Lets Do Some Exercises</Text>

            <Text style={styles.sectionTitle}>Savings</Text>
            <TaskCard
              title="Savings Task"
              description={`Completed ${savingsCompleted}/3`}
              image={require("../../assets/images/safe box.png")}
              onPress={() => router.push({ pathname: "/edufinance-quiz", params: { category: "savings" } })}
            />

            <Text style={styles.sectionTitle}>Budgeting</Text>
            <TaskCard
              title="Budgeting Task"
              description={`Completed ${budgetingCompleted}/3`}
              image={require("../../assets/images/wallet with cash.png")}
              onPress={() => router.push({ pathname: "/edufinance-quiz", params: { category: "budgeting" } })}
            />

            <Text style={styles.sectionTitle}>Debt Management</Text>
            <TaskCard
              title="Debt Task"
              description={`Completed ${debtCompleted}/3`}
              image={require("../../assets/images/credit card.png")}
              onPress={() => router.push({ pathname: "/edufinance-quiz", params: { category: "debt" } })}
            />

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
                <Text style={styles.sectionTitle}>Badges Earned</Text>
                <View style={styles.badgeRow}>
                  {badges.map((badge) => {
                    const meta = BADGE_CONFIG[badge.badge_code] || { emoji: "🏆" };
                    return (
                      <View key={badge.badge_code} style={styles.badgePill}>
                        <Text style={styles.badgeEmoji}>{meta.emoji}</Text>
                        <View style={{ marginLeft: 6 }}>
                          <Text style={styles.badgeName}>{badge.badge_name}</Text>
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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



const TaskCard: React.FC<TaskCardProps> = ({ title, description, multiline, image, imageStyle, showCircle = true, onPress }) => {
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
          <View style={styles.circleOuter} />
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
    color: "#ffffff",
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
    marginBottom: 18,
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
  circleOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#2F80ED",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  circleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2F80ED",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9FFF4",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 50,
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
});
