import type { AppState, Exam, Plan, PriorityLevel, Status, Task, TaskKind, Topic } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (iso: string) => new Date(iso + "T00:00:00");
export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
export const fmtDay = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};

const IMP = { Low: 2, Medium: 5, High: 8 } as const;
const DIFF = { Easy: 1, Medium: 3, Hard: 5 } as const;
const STAT: Record<Status, number> = { "Not Started": 8, Learning: 4, Revised: 0 };
const WEIGHT = { Low: 1, Medium: 2, High: 3 } as const;

export interface PriorityInfo {
  score: number;
  level: PriorityLevel;
  reasons: string[];
  verified: boolean;
  pyqCount: number;
}

const normKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function countTopicPyqEvidence(
  t: Topic,
  papers?: { text: string; review: string }[],
): { paperCount: number; repetitions: number } {
  if (!papers?.length) return { paperCount: 0, repetitions: 0 };
  const verifiedPapers = papers.filter((p) => p.review === "verified" && p.text.trim());
  if (!verifiedPapers.length) return { paperCount: 0, repetitions: 0 };

  const keys = [
    normKey(t.name),
    ...(t.subtopics ?? []).map((s) => normKey(s)).filter((k) => k.length > 3),
  ].filter(Boolean);
  if (!keys.length) return { paperCount: 0, repetitions: 0 };

  let paperCount = 0;
  let repetitions = 0;
  for (const p of verifiedPapers) {
    const hay = ` ${normKey(p.text)} `;
    let matchedInPaper = false;
    for (const k of keys) {
      if (hay.includes(` ${k} `)) {
        matchedInPaper = true;
        const parts = hay.split(` ${k} `);
        repetitions += Math.max(1, parts.length - 1);
      }
    }
    if (matchedInPaper) paperCount++;
  }
  return { paperCount, repetitions };
}

export function topicPriority(
  t: Topic,
  exam: Exam,
  today: string,
  papers?: { text: string; review: string }[],
): PriorityInfo {
  const days = Math.max(0, daysBetween(today, exam.date));
  const prox = days <= 3 ? 8 : days <= 7 ? 5 : days <= 14 ? 3 : 1;
  const { paperCount, repetitions } = countTopicPyqEvidence(t, papers);
  const pyqBonus =
    paperCount > 0
      ? Math.min(8, paperCount * 2 + Math.min(2, Math.max(0, repetitions - paperCount)))
      : 0;

  const verified = t.priorityVerified !== false || paperCount > 0;
  const distinctSubs = (t.subtopics ?? []).filter(
    (s) => normKey(s) && normKey(s) !== normKey(t.name),
  );
  const syllabusRelevance =
    t.priorityVerified === false && paperCount === 0
      ? distinctSubs.length >= 3
        ? 6
        : distinctSubs.length >= 1
          ? 5
          : IMP.Medium
      : IMP[t.importance];

  const score = syllabusRelevance + DIFF[t.difficulty] + STAT[t.status] + prox + pyqBonus;
  const reasons: string[] = [];

  if (paperCount > 0) {
    reasons.push(
      `PYQ evidence: appeared in ${paperCount} verified paper${paperCount === 1 ? "" : "s"} (${repetitions} mention${repetitions === 1 ? "" : "s"}, +${pyqBonus})`,
    );
  } else if (!verified) {
    reasons.push(
      `Priority not verified (no PYQ or marks evidence; syllabus relevance +${syllabusRelevance})`,
    );
  } else {
    reasons.push(`${t.importance} importance (+${IMP[t.importance]})`);
  }

  reasons.push(
    `${t.difficulty} difficulty (+${DIFF[t.difficulty]})`,
    `Status: ${t.status} (+${STAT[t.status]})`,
    `Exam in ${days} day${days === 1 ? "" : "s"} (+${prox})`,
  );

  const level: PriorityLevel = score >= 20 ? "High" : score >= 13 ? "Medium" : "Low";
  return { score, level, reasons, verified, pyqCount: paperCount };
}

export function estimateMinutes(t: Topic) {
  const base = { Easy: 60, Medium: 120, Hard: 180 }[t.difficulty];
  const f = { "Not Started": 1, Learning: 0.55, Revised: 0.25 }[t.status];
  return Math.max(15, Math.round((base * f) / 15) * 15);
}

export const upcomingExams = (exams: Exam[], today: string) =>
  exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

export function rankedTopics(
  exams: Exam[],
  today: string,
  papers?: { text: string; review: string }[],
) {
  return upcomingExams(exams, today)
    .flatMap((exam) =>
      exam.topics.map((topic) => ({
        exam,
        topic,
        info: topicPriority(topic, exam, today, papers),
        minutes: estimateMinutes(topic),
      })),
    )
    .sort((a, b) => b.info.score - a.info.score);
}

const capacity = (exams: Exam[], day: string) =>
  Math.max(0, ...exams.filter((e) => e.date > day).map((e) => e.hoursPerDay * 60));

/** Interleave tasks across units within each priority tier so all syllabus units are covered evenly. */
function interleaveByUnit(chunks: Task[], deadline: Record<string, string>): Task[] {
  const sorted = [...chunks].sort(
    (a, b) =>
      b.score - a.score || (deadline[a.examId] ?? "").localeCompare(deadline[b.examId] ?? ""),
  );

  const groups = new Map<string, Task[]>();
  const unitOrder: string[] = [];
  for (const c of sorted) {
    const key = `${c.examId}::${c.unit || "default"}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      unitOrder.push(key);
    }
    groups.get(key)!.push(c);
  }

  if (unitOrder.length <= 1) return sorted;

  const result: Task[] = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    // Pick the highest-scoring next task across available units in round-robin order
    let addedInPass = false;
    for (const key of unitOrder) {
      const queue = groups.get(key)!;
      if (queue.length > 0) {
        result.push(queue.shift()!);
        remaining--;
        addedInPass = true;
      }
    }
    if (!addedInPass) break;
  }
  return result;
}

function place(chunks: Task[], exams: Exam[], start: string, used: Record<string, number>) {
  const deadline: Record<string, string> = Object.fromEntries(exams.map((e) => [e.id, e.date]));
  const ordered = interleaveByUnit(chunks, deadline);
  const placed: Task[] = [];
  const overflow: Task[] = [];

  // Calculate total work vs available days per exam to spread topics realistically across days
  const maxDeadline = exams.reduce((m, e) => (e.date > m ? e.date : m), start);
  const totalDays = Math.max(1, daysBetween(start, maxDeadline));
  const totalChunkMin = ordered.reduce((s, c) => s + c.minutes, 0);
  const totalUsedMin = Object.values(used).reduce((s, v) => s + v, 0);
  const maxChunkMin = ordered.reduce((m, c) => Math.max(m, c.minutes), 0);
  const targetDailyMin = Math.max(
    maxChunkMin,
    Math.ceil((totalChunkMin + totalUsedMin) / totalDays / 15) * 15,
  );

  for (const c of ordered) {
    const end = deadline[c.examId] ?? "";
    let day = start;
    let ok = false;
    // Pass 1: distribute realistically across available days using balanced daily target
    while (day < end) {
      const cap = Math.min(capacity(exams, day), targetDailyMin);
      if ((used[day] ?? 0) + c.minutes <= cap) {
        used[day] = (used[day] ?? 0) + c.minutes;
        placed.push({ ...c, date: day });
        ok = true;
        break;
      }
      day = addDays(day, 1);
    }
    // Pass 2: use full daily capacity if balanced target was full
    if (!ok) {
      day = start;
      while (day < end) {
        const cap = capacity(exams, day);
        if ((used[day] ?? 0) + c.minutes <= cap) {
          used[day] = (used[day] ?? 0) + c.minutes;
          placed.push({ ...c, date: day });
          ok = true;
          break;
        }
        day = addDays(day, 1);
      }
    }
    if (!ok) overflow.push({ ...c, date: "" });
  }
  return { placed, overflow };
}

function chunksFor(
  exam: Exam,
  topic: Topic,
  minutes: number,
  today: string,
  papers?: { text: string; review: string }[],
): Task[] {
  const info = topicPriority(topic, exam, today, papers);
  const kind: TaskKind =
    topic.status === "Not Started" ? "learn" : topic.status === "Learning" ? "deepen" : "revise";
  const verb = { learn: "Study", deepen: "Deepen", revise: "Revise" }[kind];
  const n = Math.ceil(minutes / 90);
  const each = Math.max(15, Math.round(minutes / n / 15) * 15);
  const unitPrefix = topic.unit ? `${topic.unit}: ` : "";
  const distinctSubtopics = (topic.subtopics ?? []).filter(
    (s) => s.trim() && s.trim().toLowerCase() !== topic.name.trim().toLowerCase(),
  );

  return Array.from({ length: n }, (_, i) => {
    let sessionSubtopics = distinctSubtopics;
    if (n > 1 && distinctSubtopics.length >= n) {
      const perChunk = Math.ceil(distinctSubtopics.length / n);
      sessionSubtopics = distinctSubtopics.slice(i * perChunk, (i + 1) * perChunk);
    }
    const subtopicSuffix = sessionSubtopics.length > 0 ? ` — ${sessionSubtopics.join(", ")}` : "";
    const sessionPart = n > 1 && distinctSubtopics.length < n ? ` (Session ${i + 1}/${n})` : "";

    return {
      id: uid(),
      examId: exam.id,
      topicId: topic.id,
      title: `${verb}: ${unitPrefix}${topic.name}${subtopicSuffix}${sessionPart}`,
      date: "",
      minutes: each,
      priority: info.level,
      score: info.score,
      kind,
      done: false,
      unit: topic.unit,
      topicName: topic.name,
      subtopics: sessionSubtopics.length > 0 ? sessionSubtopics : topic.subtopics,
      priorityVerified: info.verified,
    };
  });
}

export function generatePlan(
  exams: Exam[],
  prev: Plan | null,
  today: string,
  papers?: { text: string; review: string }[],
): Plan {
  const kept = (prev?.tasks ?? []).filter((t) => t.done);
  const doneMin: Record<string, number> = {};
  const used: Record<string, number> = {};
  for (const t of kept) {
    if (prev && t.completedAt && t.completedAt >= prev.generatedAt)
      doneMin[t.topicId] = (doneMin[t.topicId] ?? 0) + t.minutes;
    if (t.date >= today) used[t.date] = (used[t.date] ?? 0) + t.minutes;
  }
  const chunks: Task[] = [];
  for (const exam of exams.filter((e) => e.date > today)) {
    for (const topic of exam.topics) {
      const rem = estimateMinutes(topic) - (doneMin[topic.id] ?? 0);
      if (rem >= 15) chunks.push(...chunksFor(exam, topic, rem, today, papers));
    }
  }
  const { placed, overflow } = place(chunks, exams, today, used);
  return { generatedAt: today, tasks: [...kept, ...placed], unscheduled: overflow };
}

export function recoverPlan(exams: Exam[], plan: Plan, today: string) {
  const missed = [
    ...plan.tasks.filter((t) => !t.done && t.date < today),
    ...plan.unscheduled,
  ].filter((t) => exams.some((e) => e.id === t.examId && e.date > today));
  const rest = plan.tasks.filter((t) => t.done || t.date >= today);
  const used: Record<string, number> = {};
  for (const t of rest) if (t.date >= today) used[t.date] = (used[t.date] ?? 0) + t.minutes;
  const { placed, overflow } = place(missed, exams, today, used);
  return {
    plan: { ...plan, tasks: [...rest, ...placed], unscheduled: overflow },
    moved: placed.length,
    overflow: overflow.length,
  };
}

export function readiness(state: AppState, today: string) {
  const topics = upcomingExams(state.exams, today).flatMap((e) => e.topics);
  if (!topics.length) return null;
  const sv: Record<Status, number> = { "Not Started": 0, Learning: 0.5, Revised: 1 };
  const wSum = topics.reduce((s, t) => s + WEIGHT[t.importance], 0);
  const coverage = topics.reduce((s, t) => s + WEIGHT[t.importance] * sv[t.status], 0) / wSum;
  const revision = topics.filter((t) => t.status === "Revised").length / topics.length;
  const recent = state.quizzes.slice(-5);
  const hasQuiz = recent.length > 0;
  const quiz = hasQuiz ? recent.reduce((s, q) => s + q.score / q.total, 0) / recent.length : 0;
  const due = (state.plan?.tasks ?? []).filter((t) => t.date && t.date <= today);
  const taskRate = due.length ? due.filter((t) => t.done).length / due.length : coverage;
  const score = hasQuiz
    ? 0.45 * coverage + 0.2 * revision + 0.2 * quiz + 0.15 * taskRate
    : 0.55 * coverage + 0.25 * revision + 0.2 * taskRate;
  return {
    score: Math.round(score * 100),
    coverage,
    revision,
    quiz,
    taskRate,
    hasQuiz,
    topicCount: topics.length,
  };
}

export function topicQuizAccuracy(state: AppState) {
  const acc: Record<string, { correct: number; total: number }> = {};
  for (const q of state.quizzes)
    for (const [k, v] of Object.entries(q.perTopic)) {
      const key = k.toLowerCase();
      acc[key] = {
        correct: (acc[key]?.correct ?? 0) + v.correct,
        total: (acc[key]?.total ?? 0) + v.total,
      };
    }
  return acc;
}

export function weeklyMinutes(state: AppState, today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const minutes = (state.plan?.tasks ?? [])
      .filter((t) => t.done && t.completedAt === day)
      .reduce((s, t) => s + t.minutes, 0);
    return { day: parseISO(day).toLocaleDateString(undefined, { weekday: "short" }), minutes };
  });
}
