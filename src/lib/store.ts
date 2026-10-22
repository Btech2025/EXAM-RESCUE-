import { useSyncExternalStore } from "react";
import { addDays, generatePlan, recoverPlan, todayISO, uid } from "./engine";
import type { AppState, Exam, QuizResult, Status } from "./types";
import { appendStrategy, type Intelligence, type StrategyDay } from "./intelligence";

const KEY = "exam-rescue-v1";
let state: AppState | null = null;
const listeners = new Set<() => void>();

const t = (
  name: string,
  difficulty: "Easy" | "Medium" | "Hard",
  importance: "Low" | "Medium" | "High",
  status: Status,
) => ({
  id: uid(),
  name,
  difficulty,
  importance,
  status,
});

export function createSample(): AppState {
  const today = todayISO();
  const exams: Exam[] = [
    {
      id: uid(),
      name: "CS201 Mid-Semester",
      subject: "Data Structures",
      date: addDays(today, 6),
      hoursPerDay: 3,
      topics: [
        t("Arrays & Linked Lists", "Easy", "Medium", "Revised"),
        t("Stacks & Queues", "Easy", "Medium", "Learning"),
        t("Trees & BST", "Hard", "High", "Learning"),
        t("Graphs", "Hard", "High", "Not Started"),
        t("Hashing", "Medium", "Medium", "Not Started"),
        t("Sorting Algorithms", "Medium", "High", "Learning"),
      ],
    },
    {
      id: uid(),
      name: "MA102 End-Term",
      subject: "Engineering Mathematics",
      date: addDays(today, 11),
      hoursPerDay: 2.5,
      topics: [
        t("Laplace Transforms", "Hard", "High", "Not Started"),
        t("Fourier Series", "Hard", "High", "Not Started"),
        t("Vector Calculus", "Medium", "Medium", "Learning"),
        t("Complex Numbers", "Easy", "Low", "Revised"),
        t("Differential Equations", "Medium", "High", "Learning"),
      ],
    },
    {
      id: uid(),
      name: "CS301 Quiz 2",
      subject: "Operating Systems",
      date: addDays(today, 17),
      hoursPerDay: 2,
      topics: [
        t("Process Scheduling", "Medium", "High", "Learning"),
        t("Deadlocks", "Medium", "High", "Not Started"),
        t("Memory Management", "Hard", "High", "Not Started"),
        t("Synchronization", "Hard", "Medium", "Not Started"),
        t("File Systems", "Easy", "Low", "Not Started"),
      ],
    },
  ];
  const start = addDays(today, -4);
  const plan = generatePlan(exams, null, start);
  let skipped = 0;
  plan.tasks = plan.tasks.map((task) => {
    if (task.date < today) {
      if (skipped < 2 && task.date === addDays(today, -1)) {
        skipped++;
        return task;
      }
      return { ...task, done: true, completedAt: task.date };
    }
    return task;
  });
  const quizzes: QuizResult[] = [
    {
      id: uid(),
      date: addDays(today, -2),
      subject: "Data Structures",
      score: 3,
      total: 5,
      perTopic: {
        "Trees & BST": { correct: 0, total: 1 },
        "Stacks & Queues": { correct: 1, total: 1 },
        Graphs: { correct: 0, total: 1 },
        Hashing: { correct: 1, total: 1 },
        "Arrays & Linked Lists": { correct: 1, total: 1 },
      },
    },
  ];
  return { exams, plan, quizzes, settings: { name: "Aarchi" } };
}

import { getCurrentUser } from "./auth";

function getDataKey(): string {
  const user = getCurrentUser();
  return user ? `exam-rescue-data-${user.id}` : KEY;
}

export function createEmptyState(name = ""): AppState {
  return {
    exams: [],
    plan: null,
    quizzes: [],
    settings: { name },
  };
}

const emit = () => listeners.forEach((l) => l());
const persist = () => {
  try {
    localStorage.setItem(getDataKey(), JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
};

export function loadState(forceReload = false) {
  if (state && !forceReload) return;
  const user = getCurrentUser();
  const key = getDataKey();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      state = JSON.parse(raw) as AppState;
    } else if (user && user.id !== "demo_student_account") {
      // Clean start for real users: no pre-filled sample data
      state = createEmptyState(user.name);
    } else {
      state = createSample();
    }
  } catch {
    state =
      user && user.id !== "demo_student_account" ? createEmptyState(user.name) : createSample();
  }
  persist();
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("exam-rescue:auth-changed", () => {
    loadState(true);
  });
}

function set(fn: (s: AppState) => AppState) {
  state = fn(state!);
  persist();
  emit();
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state!,
    () => state!,
  );
}

export const actions = {
  saveIntelligence(intelligence: Intelligence) {
    set((s) => ({ ...s, intelligence }));
  },
  deleteIntelligence() {
    set(({ intelligence: _removed, ...s }) => s);
  },
  sendStrategy(exam: Exam, days: StrategyDay[]) {
    set((s) => ({
      ...s,
      exams: s.exams.some((e) => e.id === exam.id)
        ? s.exams.map((e) => (e.id === exam.id ? exam : e))
        : [...s.exams, exam],
      plan: appendStrategy(s.plan, exam.id, days, todayISO()),
    }));
  },
  saveExam(exam: Exam) {
    set((s) => ({
      ...s,
      exams: s.exams.some((e) => e.id === exam.id)
        ? s.exams.map((e) => (e.id === exam.id ? exam : e))
        : [...s.exams, exam],
    }));
  },
  deleteExam(id: string) {
    set((s) => ({
      ...s,
      exams: s.exams.filter((e) => e.id !== id),
      plan: s.plan
        ? {
            ...s.plan,
            tasks: s.plan.tasks.filter((t) => t.examId !== id),
            unscheduled: s.plan.unscheduled.filter((t) => t.examId !== id),
          }
        : null,
    }));
  },
  deleteTopic(examId: string, topicId: string) {
    set((s) => ({
      ...s,
      exams: s.exams.map((e) =>
        e.id === examId ? { ...e, topics: e.topics.filter((t) => t.id !== topicId) } : e,
      ),
      plan: s.plan
        ? {
            ...s.plan,
            tasks: s.plan.tasks.filter((t) => t.topicId !== topicId),
            unscheduled: s.plan.unscheduled.filter((t) => t.topicId !== topicId),
          }
        : null,
    }));
  },
  setTopicStatus(topicId: string, status: Status) {
    set((s) => ({
      ...s,
      exams: s.exams.map((e) => ({
        ...e,
        topics: e.topics.map((t) => (t.id === topicId ? { ...t, status } : t)),
      })),
    }));
  },
  toggleTask(taskId: string) {
    set((s) => {
      if (!s.plan) return s;
      const today = todayISO();
      const tasks = s.plan.tasks.map((t) =>
        t.id === taskId ? { ...t, done: !t.done, completedAt: !t.done ? today : undefined } : t,
      );
      const task = tasks.find((t) => t.id === taskId)!;
      let exams = s.exams;
      const siblings = tasks.filter((t) => t.topicId === task.topicId);
      if (task.done && siblings.every((t) => t.done)) {
        exams = exams.map((e) => ({
          ...e,
          topics: e.topics.map((tp) =>
            tp.id === task.topicId
              ? { ...tp, status: (tp.status === "Not Started" ? "Learning" : "Revised") as Status }
              : tp,
          ),
        }));
      }
      return { ...s, exams, plan: { ...s.plan, tasks } };
    });
  },
  regenerate() {
    let warn = 0;
    set((s) => {
      const plan = generatePlan(s.exams, s.plan, todayISO(), s.intelligence?.papers);
      warn = plan.unscheduled.length;
      return { ...s, plan };
    });
    return warn;
  },
  recover() {
    let res = { moved: 0, overflow: 0 };
    set((s) => {
      if (!s.plan) {
        const plan = generatePlan(s.exams, null, todayISO(), s.intelligence?.papers);
        res = { moved: plan.tasks.length, overflow: plan.unscheduled.length };
        return { ...s, plan };
      }
      const r = recoverPlan(s.exams, s.plan, todayISO());
      res = { moved: r.moved, overflow: r.overflow };
      return { ...s, plan: r.plan };
    });
    return res;
  },
  saveQuiz(q: QuizResult) {
    set((s) => ({ ...s, quizzes: [...s.quizzes, q] }));
  },
  setName(name: string) {
    set((s) => ({ ...s, settings: { ...s.settings, name } }));
  },
  resetSample() {
    set(() => createSample());
  },
  setUserStudyData(exams: Exam[], name?: string) {
    set((s) => {
      const today = todayISO();
      const verifiedPapers = s.intelligence?.papers?.filter((p) => p.review === "verified") ?? [];
      const plan = generatePlan(exams, null, today, verifiedPapers);
      const { intelligence: _staleIntelligence, ...rest } = s;
      return {
        ...rest,
        exams,
        plan,
        settings: { ...s.settings, name: name || s.settings.name },
      };
    });
  },
  clearAll() {
    set(() => ({
      exams: [],
      plan: null,
      quizzes: [],
      settings: { name: state?.settings.name ?? "" },
    }));
  },
};
