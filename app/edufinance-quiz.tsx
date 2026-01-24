// app/edufinance-quiz.tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../utils/supabase";

const PRIMARY = "#00D09E";
const BG_LIGHT = "#E9FFF4";

function inferCorrectIdx(item: QuizItem): number {
  const marks = (s?: string) => /✅|correct/i.test(String(s ?? ""));

  if (marks(item.explanation1)) return 0;
  if (marks(item.explanation2)) return 1;
  if (marks(item.explanation3)) return 2;

  // fallback to correct_index if no marker found
  const ci = Number(item.correct_index);

  // if it's 1..3, convert to 0..2
  if (ci >= 1 && ci <= 3) return ci - 1;

  // if it's already 0..2, use it
  return Math.max(0, Math.min(2, ci));
}

function getCorrectIdx0(correct_index: number) {
  // supports both:
  // 1-based (1,2,3) -> (0,1,2)
  // 0-based (0,1,2) -> (0,1,2)
  if (correct_index >= 1 && correct_index <= 3) return correct_index - 1;
  return correct_index; // assume already 0-based
}

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKeyLocal() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // YYYY-MM-DD
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

const savingsImg = require("../assets/images/atm.png");
const budgetingImg = require("../assets/images/budget.png");
const debtImg = require("../assets/images/debt.png");

export default function EduFinanceQuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawCategory = params.category as string | undefined;
  const category: Category =
    rawCategory === "budgeting" || rawCategory === "debt"
      ? rawCategory
      : "savings";

  const taskId = params.taskId as string | undefined;

  const [activeTab, setActiveTab] = useState<"notes" | "tasks">("tasks");
  const [notesTitle, setNotesTitle] = useState<string>("");
  const [notesContent, setNotesContent] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState<boolean>(false);

  const ensureDailyTasksGenerated = useCallback(async () => {
    // today in local format YYYY-MM-DD
    const taskDate = getTodayKeyLocal();

    // If your SQL function accepts p_date:
    const { error } = await supabase.rpc("generate_daily_edufinance_tasks", {
      p_date: taskDate,
    });

    // If your function DOES NOT accept params, use:
    // const { error } = await supabase.rpc("generate_daily_edufinance_tasks");

    if (error) {
      console.log("generate_daily_edufinance_tasks error:", error.message);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!category) return;

    setNotesLoading(true);
    try {
      // 1) task-specific note
      if (taskId) {
        const { data: taskNote, error: taskErr } = await supabase
          .from("edu_notes")
          .select("title, content")
          .eq("category", category)
          .eq("task_id", Number(taskId))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!taskErr && taskNote) {
          setNotesTitle(taskNote.title);
          setNotesContent(taskNote.content);
          return;
        }
      }

      // 2) fallback: category note
      const { data: catNote, error: catErr } = await supabase
        .from("edu_notes")
        .select("title, content")
        .eq("category", category)
        .is("task_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (catErr) {
        console.log("loadNotes category error:", catErr.message);
        setNotesTitle("Notes");
        setNotesContent("No notes available right now.");
        return;
      }

      setNotesTitle(catNote?.title ?? "Notes");
      setNotesContent(catNote?.content ?? "No notes available right now.");
    } finally {
      setNotesLoading(false);
    }
  }, [category, taskId]);

  const [hasStreakToday, setHasStreakToday] = useState(false);

  const saveProgress = async (
    item: QuizItem,
    selectedIndex: number,
    isCorrect: boolean,
  ) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      console.log("No user for progress:", authError);
      return;
    }

    // ✅ local YYYY-MM-DD (same helper you used elsewhere)
    const taskDate = getTodayKeyLocal();

    const { error: upsertError } = await supabase
      .from("edufinance_task_progress")
      .upsert(
        {
          user_id: user.id,
          task_id: item.id,
          category,
          task_date: taskDate, // ✅ NEW
          selected_index: selectedIndex,
          is_correct: isCorrect,
        },
        {
          // ✅ IMPORTANT: include task_date in conflict
          onConflict: "user_id,task_id,task_date",
        },
      );

    if (upsertError) {
      console.log("saveProgress upsert error:", upsertError.message);
    }
  };

  const awardStreakIfNeeded = async () => {
    if (hasStreakToday) return;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      console.log("No logged-in user, cannot award streak:", authError);
      return;
    }

    const today = getTodayDateString();

    const { data: existing, error: existingError } = await supabase
      .from("user_streaks")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existingError) {
      console.log("Error checking streak:", existingError);
      return;
    }

    if (existing) {
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

  const heroImage =
    category === "savings"
      ? savingsImg
      : category === "budgeting"
        ? budgetingImg
        : debtImg;

  const heroTitle =
    category === "savings"
      ? "Savings"
      : category === "budgeting"
        ? "Budget"
        : "Debt";

  useEffect(() => {
    const fetchTasks = async () => {
      loadNotes();
      setLoading(true);
      setError(null);

      await ensureDailyTasksGenerated();

      const { data, error } = await supabase
        .from("edufinance_tasks")
        .select("*")
        .eq("category", category)
        .eq("task_date", getTodayKeyLocal())
        .order("id")
        .limit(3);

      if (error) {
        console.log("Error fetching tasks:", error);
        setError("Unable to load tasks for today.");
        setQuizItems([]);
      } else {
        setQuizItems(data || []);
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();
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
  }, [category, taskId, loadNotes, ensureDailyTasksGenerated]);

  const handleSelect = (item: QuizItem, index: number, correctIdx0: number) => {
    setSelectedOption((prev) => ({
      ...prev,
      [item.id.toString()]: index,
    }));

    const isCorrect = index === correctIdx0;

    awardStreakIfNeeded();
    saveProgress(item, index, isCorrect);

    // ✅ Debug log (super useful)
    console.log("TASK:", item.title, {
      selected: index,
      correctIdx0,
      rawCorrectIndex: item.correct_index,
    });
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#093030" />
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
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "notes" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("notes")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "notes" && styles.tabTextActive,
              ]}
            >
              Notes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === "tasks" && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab("tasks")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "tasks" && styles.tabTextActive,
              ]}
            >
              Tasks
            </Text>
          </TouchableOpacity>
        </View>
        {activeTab === "notes" ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.notesHero}>
              <View style={styles.circleBg}>
                <Image
                  source={heroImage}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.notesHeroTitle}>{heroTitle}</Text>
            </View>
            <View style={styles.notesCard}>
              <Text style={styles.notesTitle}>{notesTitle || "Notes"}</Text>

              {notesLoading ? (
                <Text style={styles.notesBody}>Loading notes...</Text>
              ) : (
                <Text style={styles.notesBody}>{notesContent}</Text>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        ) : (
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
              // ✅ selected is defined HERE (fixes "Cannot find name 'selected'")
              const selected = selectedOption[item.id.toString()] ?? null;

              // ✅ Decide correct answer index ONCE (0,1,2)
              const correctIdx0 = (() => {
                const marks = (s?: string) =>
                  /✅|correct/i.test(String(s ?? ""));

                if (marks(item.explanation1)) return 0;
                if (marks(item.explanation2)) return 1;
                if (marks(item.explanation3)) return 2;

                const ci = Number(item.correct_index);

                // if DB stored 1..3 → convert
                if (ci >= 1 && ci <= 3) return ci - 1;

                // if DB stored 0..2 → keep
                if (ci >= 0 && ci <= 2) return ci;

                // fallback safe
                return 0;
              })();

              const options = [
                { text: item.option1, explanation: item.explanation1 },
                { text: item.option2, explanation: item.explanation2 },
                { text: item.option3, explanation: item.explanation3 },
              ];

              return (
                <View key={item.id} style={styles.quizCard}>
                  <Text style={styles.quizTitle}>{item.title}</Text>
                  <Text style={styles.quizQuestion}>{item.question}</Text>

                  {options.map((opt, idx) => {
                    const isSelected = selected === idx;
                    const isCorrectOption = idx === correctIdx0;

                    let backgroundColor = "#F1F5F4";

                    // ✅ Only color AFTER user selects
                    if (selected !== null) {
                      if (isSelected && isCorrectOption)
                        backgroundColor = "#C8F7D0"; // green
                      else if (isSelected && !isCorrectOption)
                        backgroundColor = "#FFD6D6"; // red
                    }

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.optionButton, { backgroundColor }]}
                        onPress={() => handleSelect(item, idx, correctIdx0)} // ✅ pass correctIdx0
                      >
                        <Text style={styles.optionText}>{opt.text}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {selected !== null &&
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
        )}
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
    color: "#093030",
    fontSize: 18,
    fontWeight: "700",
  },
  innerContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 24,
    paddingHorizontal: 20,
    height: 750,
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
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F1F5F4",
    alignItems: "center",
  },

  tabPillActive: {
    backgroundColor: "#00D09E", // match your theme
  },

  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  tabTextActive: {
    color: "#fff",
  },

  notesCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  notesTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    color: "#111827",
  },

  notesBullet: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
    lineHeight: 18,
  },
  notesBody: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 19,
  },
  notesHero: {
    marginTop: 20,
    marginBottom: 12,
  },

  notesHeroImage: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#D1FAE5",
    alignSelf: "center",
    marginBottom: 20,
  },

  notesHeroTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "900",
    color: "#093030",
    textAlign: "center",
    marginBottom: 20,
  },
  circleBg: {
    width: 320, // 👈 increase this to make circle bigger
    height: 320, // 👈 must match width
    borderRadius: 160, // 👈 width / 2
    backgroundColor: "#D1FAE5", // soft green
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  heroImage: {
    width: 250,
    height: 250,
  },
});
