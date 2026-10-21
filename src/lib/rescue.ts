import {
  addDays,
  daysBetween,
  estimateMinutes,
  parseISO,
  toISO,
  topicPriority,
  topicQuizAccuracy,
} from "./engine";
import type { AppState, Exam, Topic } from "./types";

/** Exams are assumed to start at 09:00 local time (same as the Overview countdown). */
export const EXAM_HOUR = 9;
const FOCUS = 50; // max focused block
const BREAK = 10; // break after each focus block (counts toward study hours)
const PRACTICE = 15; // quick practice / recall after each topic

export type SessionKind = "focus" | "break" | "practice";
export interface Session {
  kind: SessionKind;
  title: string;
  minutes: number;
  topicId?: string;
}
export interface RescueDay {
  date: string;
  budget: number;
  used: number;
  sessions: Session[];
}

export interface RescueTopic {
  topic: Topic;
  value: number;
  base: number;
  quizBonus: number;
  minutes: number; // study + practice time needed (breaks excluded)
  quiz: { correct: number; total: number } | null;
  reasons: string[];
}

export interface RescueResult {
  exam: Exam;
  msLeft: number;
  availableMin: number;
  neededMin: number; // incl. breaks
  ranked: RescueTopic[];
  top3: RescueTopic[];
  days: RescueDay[];
  covered: string[];
  partial: { name: string; doneMin: number; needMin: number }[];
  dropped: RescueTopic[];
  examToday: boolean;
}

export function examStart(exam: Exam) {
  const d = parseISO(exam.date);
  d.setHours(EXAM_HOUR, 0, 0, 0);
  return d;
}

/** Minutes the student can still study on a given day before the exam, never above their daily hours. */
function dayBudget(exam: Exam, day: string, now: Date, doneToday: number) {
  const daily = Math.round(exam.hoursPerDay * 60);
  const today = toISO(now);
  if (day >= exam.date) return 0; // no study planned on exam morning
  if (day !== today) return daily;
  const leftToday = Math.max(0, 23 * 60 - (now.getHours() * 60 + now.getMinutes())); // stop by 11pm
  return Math.max(0, Math.min(daily - doneToday, leftToday));
}

export function rescueAnalysis(
  state: AppState,
  examId: string | undefined,
  now = new Date(),
): RescueResult | null {
  const today = toISO(now);
  const upcoming = state.exams
    .filter((e) => examStart(e).getTime() > now.getTime() && e.topics.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  const exam = upcoming.find((e) => e.id === examId) ?? upcoming[0];
  if (!exam) return null;

  const acc = topicQuizAccuracy(state);
  const ranked: RescueTopic[] = exam.topics
    .filter((t) => {
      const quiz = acc[t.name.toLowerCase()];
      return t.status !== "Revised" || (quiz && quiz.total > 0 && quiz.correct / quiz.total < 0.8);
    })
    .map((topic) => {
      const p = topicPriority(topic, exam, today);
      const accuracy = acc[topic.name.toLowerCase()];
      const q = accuracy && accuracy.total > 0 ? accuracy : null;
      const ratio = q ? q.correct / q.total : null;
      const quizBonus = ratio === null ? 0 : ratio < 0.5 ? 6 : ratio < 0.8 ? 3 : -2;
      const study = estimateMinutes(topic);
      const reasons: string[] = [];
      if (topic.importance === "High")
        reasons.push("High exam importance — likely to carry many marks");
      else if (topic.importance === "Medium") reasons.push("Moderate exam weight");
      if (q && ratio !== null && ratio < 0.5)
        reasons.push(`Weak quiz result: ${q.correct}/${q.total} correct`);
      else if (q && ratio !== null && ratio < 0.8)
        reasons.push(`Shaky quiz result: ${q.correct}/${q.total} correct`);
      else if (q) reasons.push(`Quiz looks solid (${q.correct}/${q.total}) — lower urgency`);
      if (topic.status === "Not Started") reasons.push("Not started yet — biggest preparation gap");
      else if (topic.status === "Learning")
        reasons.push("Learning but not revised — needs a revision pass");
      else reasons.push("Marked revised, but quiz says it needs a refresh");
      if (topic.difficulty === "Hard")
        reasons.push("Hard topic — needs focused time while you're fresh");
      return {
        topic,
        base: p.score,
        quizBonus,
        value: p.score + quizBonus,
        minutes: study + PRACTICE,
        quiz: q,
        reasons,
      };
    })
    // Highest value first; on ties, prefer the quicker win.
    .sort((a, b) => b.value - a.value || a.minutes - b.minutes);

  const doneToday = (state.plan?.tasks ?? [])
    .filter((t) => t.done && t.completedAt === today)
    .reduce((s, t) => s + t.minutes, 0);
  const days: RescueDay[] = [];
  for (let d = today; d < exam.date && days.length < 60; d = addDays(d, 1)) {
    const budget = dayBudget(exam, d, now, doneToday);
    if (budget > 0) days.push({ date: d, budget, used: 0, sessions: [] });
  }
  const availableMin = days.reduce((s, d) => s + d.budget, 0);

  // Lay out sessions greedily in value order. Breaks count toward the daily limit, so it is never exceeded.
  const covered: string[] = [];
  const partial: RescueResult["partial"] = [];
  const dropped: RescueTopic[] = [];
  let di = 0;
  const free = () => {
    const day = days[di];
    return day ? day.budget - day.used : 0;
  };
  const push = (s: Session) => {
    const day = days[di];
    if (!day) return;
    day.sessions.push(s);
    day.used += s.minutes;
  };
  let neededMin = 0;

  for (const rt of ranked) {
    const study = rt.minutes - PRACTICE;
    const blocks = Math.ceil(study / FOCUS);
    neededMin += rt.minutes + blocks * BREAK;
    let remaining = study;
    let part = 0;
    while (remaining > 0 && di < days.length) {
      if (free() < 15) {
        di++;
        continue;
      }
      const len = Math.min(FOCUS, remaining, free());
      part++;
      push({
        kind: "focus",
        title: `${rt.topic.status === "Not Started" ? "Learn" : "Revise"}: ${rt.topic.name}${blocks > 1 ? ` · block ${part}` : ""}`,
        minutes: len,
        topicId: rt.topic.id,
      });
      remaining -= len;
      // Never continue working on the same day without the recovery break.
      // If a break plus the next minimum session cannot fit, resume tomorrow.
      if (free() >= BREAK + 15)
        push({ kind: "break", title: "Break — water, stretch, no phone", minutes: BREAK });
      else di++;
    }
    if (remaining <= 0) {
      while (di < days.length && free() < PRACTICE) di++;
      if (di < days.length) {
        push({
          kind: "practice",
          title: `Quick recall: ${rt.topic.name} — 5 self-test questions`,
          minutes: PRACTICE,
          topicId: rt.topic.id,
        });
        covered.push(rt.topic.id);
      } else partial.push({ name: rt.topic.name, doneMin: study, needMin: rt.minutes });
    } else if (remaining < study)
      partial.push({ name: rt.topic.name, doneMin: study - remaining, needMin: rt.minutes });
    else dropped.push(rt);
  }
  // Strip trailing breaks
  for (const d of days) {
    while (d.sessions.at(-1)?.kind === "break") {
      const session = d.sessions.pop();
      if (session) d.used -= session.minutes;
    }
  }

  return {
    exam,
    msLeft: examStart(exam).getTime() - now.getTime(),
    availableMin,
    neededMin,
    ranked,
    top3: ranked.slice(0, 3),
    days: days.filter((d) => d.sessions.length),
    covered,
    partial,
    dropped,
    examToday: daysBetween(today, exam.date) === 0,
  };
}

export const rescueExams = (state: AppState, now = new Date()) =>
  state.exams
    .filter((e) => examStart(e).getTime() > now.getTime() && e.topics.length)
    .sort((a, b) => a.date.localeCompare(b.date));
