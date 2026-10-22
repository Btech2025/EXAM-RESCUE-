export type Difficulty = "Easy" | "Medium" | "Hard";
export type Importance = "Low" | "Medium" | "High";
export type Status = "Not Started" | "Learning" | "Revised";
export type PriorityLevel = "High" | "Medium" | "Low";
export type TaskKind = "learn" | "deepen" | "revise";

export interface Topic {
  id: string;
  name: string;
  difficulty: Difficulty;
  importance: Importance;
  status: Status;
  unit?: string;
  subtopics?: string[];
  unitNumber?: number;
  courseOutcomes?: string[];
  priorityVerified?: boolean;
}

export interface Exam {
  id: string;
  name: string;
  subject: string;
  date: string; // YYYY-MM-DD
  hoursPerDay: number;
  topics: Topic[];
  includedUnits?: number[];
  totalUnitsInSyllabus?: number;
  syllabusFileName?: string;
}

export interface Task {
  id: string;
  examId: string;
  topicId: string;
  title: string;
  date: string; // "" when unscheduled
  minutes: number;
  priority: PriorityLevel;
  score: number;
  kind: TaskKind;
  done: boolean;
  completedAt?: string | undefined;
  unit?: string | undefined;
  topicName?: string | undefined;
  subtopics?: string[] | undefined;
  priorityVerified?: boolean | undefined;
}

export interface Plan {
  generatedAt: string;
  tasks: Task[];
  unscheduled: Task[];
}

export interface QuizResult {
  id: string;
  date: string;
  subject: string;
  score: number;
  total: number;
  perTopic: Record<string, { correct: number; total: number }>;
}

export interface AppState {
  intelligence?: import("./intelligence").Intelligence;
  exams: Exam[];
  plan: Plan | null;
  quizzes: QuizResult[];
  settings: { name: string };
}
