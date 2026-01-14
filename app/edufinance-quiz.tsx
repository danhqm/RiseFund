// app/edufinance-quiz.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../utils/supabase";

const PRIMARY = "#05C88F";
const BG_LIGHT = "#E9FFF4";

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

type Category = "savings" | "budgeting" | "debt";

type QuizItem = {
  id: number;
  title: string;
  question: string;
  option1: string;
  option2: string;
  option3: string;
  correct_index: number; // 0,1,2
  explanation1: string;
  explanation2: string;
  explanation3: string;
};

type Option = {
  text: string;
  isCorrect: boolean;
  explanation: string;
};

export default function EduFinanceQuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [hasStreakToday, setHasStreakToday] = useState(false);

  const saveProgress = async (
    item: QuizItem,
    selectedIndex: number,
    isCorrect: boolean
    ) => {
        const {
            data: authData,
            error: authError,
        } = await supabase.auth.getUser();
        const user = authData?.user;

        if (authError || !user) {
            console.log("No user for progress:", authError);
            return;
        }

        const weekKey = getWeekKey(); // same as used when fetching tasks

        const { error: upsertError } = await supabase
            .from("edufinance_task_progress")
            .upsert(
            {
                user_id: user.id,
                task_id: item.id,
                category,
                week_key: weekKey,
                selected_index: selectedIndex,
                is_correct: isCorrect,
            },
            {
                onConflict: "user_id,task_id",
            }
            );

        if (upsertError) {
            console.log("Error saving progress:", upsertError);
        } else {
            console.log(
            `Saved progress for ${category} task ${item.id}: option ${selectedIndex}, correct=${isCorrect}`
            );
        }
    };

  const awardStreakIfNeeded = async () => {
    // If we've already recorded a streak locally, skip
    if (hasStreakToday) return;

    const {
        data: authData,
        error: authError,
    } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
        console.log("No logged-in user, cannot award streak:", authError);
        return;
    }

    const today = getTodayDateString();

    // Check if a streak already exists for today in DB
    const { data: existing, error: existingError } = await supabase
        .from("user_streaks")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

    if (existingError) {
        console.log("Error checking streak:", existingError);
        // We won't block the UI on this – just bail out
        return;
    }

    if (existing) {
        // Already has streak today – sync local state
        setHasStreakToday(true);
        return;
    }

    // Insert a new streak record for today
    const { error: insertError } = await supabase
        .from("user_streaks")
        .insert({ user_id: user.id, date: today });

    if (insertError) {
        console.log("Error inserting streak:", insertError);
        return;
    }

    console.log("🔥 Daily streak recorded for", today);
    setHasStreakToday(true);
    };

  // make sure category is one of the union types
  const rawCategory = params.category as string | undefined;
  const category: Category =
    rawCategory === "budgeting" || rawCategory === "debt"
      ? rawCategory
      : "savings";

  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<
    Record<string, number | null>
  >({}); // { [quizId]: optionIndex }

  const prettyTitle =
    category === "savings"
      ? "Savings Tasks"
      : category === "budgeting"
      ? "Budgeting Tasks"
      : "Debt Management Tasks";

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);

      const weekKey = getWeekKey(); // e.g. "2026-W03"

      const { data, error } = await supabase
        .from("edufinance_tasks")
        .select("*")
        .eq("category", category)
        .eq("week_key", weekKey)
        .order("id")
        .limit(3);

      if (error) {
        console.log("Error fetching tasks:", error);
        setError("Unable to load tasks for this week.");
        setQuizItems([]);
      } else {
        setQuizItems(data || []);
      }

      const {
        data: authData,
        error: authError,
        } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!authError && user) {
            const today = getTodayDateString();

            const { data: existing } = await supabase
                .from("user_streaks")
                .select("id")
                .eq("user_id", user.id)
                .eq("date", today)
                .maybeSingle();

            if (existing) {
                setHasStreakToday(true);
            }
        }

      setLoading(false);
    };

    fetchTasks();
  }, [category]);

  const handleSelect = (item: QuizItem, index: number) => {
    setSelectedOption((prev) => ({
        ...prev,
        [item.id.toString()]: index,
    }));

    const isCorrect = index === item.correct_index;

    // award streak once per day
    awardStreakIfNeeded();

    // save this answer to DB
    saveProgress(item, index, isCorrect);
    };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{prettyTitle}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.innerContainer}>
          <Text style={{ textAlign: "center", marginTop: 20 }}>
            Loading tasks...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // No tasks for this week
  if (!loading && quizItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{prettyTitle}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.innerContainer}>
          <Text style={{ textAlign: "center", marginTop: 20 }}>
            {error ?? "No tasks available for this week yet."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ Normal render with tasks
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{prettyTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <View style={styles.innerContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>
            Complete these 3 mini-tasks to learn more about{" "}
            {category === "savings"
              ? "saving money"
              : category === "budgeting"
              ? "budgeting"
              : "managing debt"}
            .
          </Text>

          {quizItems.map((item) => {
            const selected = selectedOption[item.id.toString()];

            const options: Option[] = [
              {
                text: item.option1,
                isCorrect: item.correct_index === 0,
                explanation: item.explanation1,
              },
              {
                text: item.option2,
                isCorrect: item.correct_index === 1,
                explanation: item.explanation2,
              },
              {
                text: item.option3,
                isCorrect: item.correct_index === 2,
                explanation: item.explanation3,
              },
            ];

            return (
              <View key={item.id} style={styles.quizCard}>
                <Text style={styles.quizTitle}>{item.title}</Text>
                <Text style={styles.quizQuestion}>{item.question}</Text>

                {options.map((opt, idx) => {
                  const isSelected = selected === idx;
                  let backgroundColor = "#F1F5F4";

                  if (isSelected && opt.isCorrect) backgroundColor = "#C8F7D0";
                  else if (isSelected && !opt.isCorrect)
                    backgroundColor = "#FFD6D6";

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.optionButton, { backgroundColor }]}
                      onPress={() => handleSelect(item, idx)}
                    >
                      <Text style={styles.optionText}>{opt.text}</Text>
                    </TouchableOpacity>
                  );
                })}

                {selected !== undefined &&
                  selected !== null &&
                  selected >= 0 &&
                  selected < options.length && (
                    <Text style={styles.explanationText}>
                      {options[selected].explanation}
                    </Text>
                  )}
              </View>
            );
          })}

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  innerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  subtitle: {
    fontSize: 13,
    color: "#4A5B5B",
    marginBottom: 20,
    textAlign: "center",
  },
  quizCard: {
    backgroundColor: BG_LIGHT,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16302A",
    marginBottom: 6,
  },
  quizQuestion: {
    fontSize: 13,
    color: "#3B4B4B",
    marginBottom: 10,
  },
  optionButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  optionText: {
    fontSize: 13,
    color: "#16302A",
  },
  explanationText: {
    marginTop: 10,
    fontSize: 12,
    color: "#3B4B4B",
  },
});
