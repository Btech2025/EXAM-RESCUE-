import { describe, expect, it } from "vitest";
import { rescueAnalysis, rescueExams } from "@/lib/rescue";
import type { AppState, Topic } from "@/lib/types";

const now = new Date("2026-10-17T12:00:00");
const topic = (id: string, overrides: Partial<Topic> = {}): Topic => ({
  id,
  name: id,
  difficulty: "Hard",
  importance: "High",
  status: "Not Started",
  ...overrides,
});
const state = (topics: Topic[], hoursPerDay = 3, date = "2026-10-20"): AppState => ({
  exams: [{ id: "exam", name: "Final", subject: "Data Structures", date, hoursPerDay, topics }],
  plan: null,
  quizzes: [],
  settings: { name: "Student" },
});

describe("Rescue Mode", () => {
  it("returns the three highest-value topics with transparent quiz bonuses", () => {
    const s = state([
      topic("weak"),
      topic("hard"),
      topic("medium", { difficulty: "Medium" }),
      topic("easy", { difficulty: "Easy", importance: "Low" }),
    ]);
    s.quizzes = [
      {
        id: "quiz",
        date: "2026-10-17",
        subject: "Data Structures",
        score: 0,
        total: 1,
        perTopic: { weak: { correct: 0, total: 1 } },
      },
    ];
    const r = rescueAnalysis(s, undefined, now);
    expect(r?.top3.map((t) => t.topic.id)).toEqual(["weak", "hard", "medium"]);
    expect(r?.top3[0]?.quizBonus).toBe(6);
    expect(r?.top3[0]?.value).toBe(35);
  });

  it("recalculates after preparation status changes", () => {
    const s = state([topic("first"), topic("second")]);
    expect(rescueAnalysis(s, undefined, now)?.top3[0]?.topic.id).toBe("first");
    const first = s.exams[0]?.topics[0];
    if (!first) throw new Error("Missing test topic");
    first.status = "Revised";
    expect(rescueAnalysis(s, undefined, now)?.ranked.map((t) => t.topic.id)).toEqual(["second"]);
  });

  it("brings a revised topic back when saved quiz accuracy is below 80 percent", () => {
    const s = state([topic("weak", { status: "Revised" })]);
    expect(rescueAnalysis(s, undefined, now)?.ranked).toEqual([]);
    s.quizzes = [
      {
        id: "quiz",
        date: "2026-10-17",
        subject: "Data Structures",
        score: 3,
        total: 5,
        perTopic: { weak: { correct: 3, total: 5 } },
      },
    ];
    expect(rescueAnalysis(s, undefined, now)?.ranked[0]?.quizBonus).toBe(3);
    const weak = s.quizzes[0]?.perTopic["weak"];
    if (!weak) throw new Error("Missing quiz result");
    weak.correct = 4;
    expect(rescueAnalysis(s, undefined, now)?.ranked).toEqual([]);
  });

  it("never schedules consecutive focus blocks without a break on the same day", () => {
    const r = rescueAnalysis(state([topic("Graphs"), topic("Trees")]), undefined, now);
    expect(r?.days.length).toBeGreaterThan(0);
    for (const day of r?.days ?? []) {
      day.sessions.forEach((session, i) => {
        if (session.kind === "focus" && day.sessions[i + 1])
          expect(day.sessions[i + 1]?.kind).toBe("break");
      });
    }
  });

  it("counts breaks and practice within daily hours and reports uncovered work", () => {
    const r = rescueAnalysis(
      state([topic("Graphs"), topic("Trees"), topic("Hashing")], 0.5, "2026-10-18"),
      undefined,
      now,
    );
    expect(r?.availableMin).toBe(30);
    expect(r?.partial[0]).toEqual({ name: "Graphs", doneMin: 30, needMin: 195 });
    expect(r?.dropped.map((t) => t.topic.id)).toEqual(["Trees", "Hashing"]);
    for (const hours of [0.5, 1, 1.5, 3, 16]) {
      const plan = rescueAnalysis(state([topic("Graphs"), topic("Trees")], hours), undefined, now);
      for (const day of plan?.days ?? []) {
        expect(day.used).toBe(day.sessions.reduce((sum, session) => sum + session.minutes, 0));
        expect(day.used).toBeLessThanOrEqual(hours * 60);
        expect(day.sessions.at(-1)?.kind).not.toBe("break");
      }
    }
    const complete = rescueAnalysis(state([topic("Graphs")]), undefined, now);
    expect(complete?.covered).toEqual(["Graphs"]);
    expect(
      complete?.days
        .flatMap((d) => d.sessions)
        .filter((s) => s.kind === "practice")
        .map((s) => s.minutes),
    ).toEqual([15]);
  });

  it("subtracts completed minutes from today's limit and stops at 11pm", () => {
    const s = state([topic("Graphs")], 3, "2026-10-18");
    s.plan = {
      generatedAt: "2026-10-17",
      unscheduled: [],
      tasks: [
        {
          id: "task",
          examId: "exam",
          topicId: "Graphs",
          title: "Study",
          date: "2026-10-17",
          minutes: 60,
          priority: "High",
          score: 20,
          kind: "learn",
          done: true,
          completedAt: "2026-10-17",
        },
      ],
    };
    expect(rescueAnalysis(s, undefined, now)?.availableMin).toBe(120);
    expect(rescueAnalysis(s, undefined, new Date("2026-10-17T22:40:00"))?.availableMin).toBe(20);
    expect(rescueAnalysis(s, undefined, new Date("2026-10-17T23:00:00"))?.availableMin).toBe(0);
  });

  it("counts down to 9am and excludes exams once they start", () => {
    const s = state([topic("Graphs")], 3, "2026-10-18");
    expect(rescueAnalysis(s, undefined, new Date("2026-10-18T08:00:00"))?.msLeft).toBe(3600000);
    expect(rescueAnalysis(s, undefined, new Date("2026-10-18T08:00:00"))?.availableMin).toBe(0);
    expect(rescueExams(s, new Date("2026-10-18T09:00:00"))).toEqual([]);
    expect(rescueAnalysis(s, undefined, new Date("2026-10-18T09:00:00"))).toBeNull();
  });

  it("uses the selected exam and falls back safely when it is removed", () => {
    const s = state([topic("Graphs")]);
    const exam = s.exams[0];
    if (!exam) throw new Error("Missing test exam");
    s.exams.push({ ...exam, id: "later", date: "2026-10-22", topics: [topic("Trees")] });
    expect(rescueAnalysis(s, "later", now)?.exam.id).toBe("later");
    s.exams.pop();
    expect(rescueAnalysis(s, "later", now)?.exam.id).toBe("exam");
    expect(rescueAnalysis(state([]), undefined, now)).toBeNull();
  });
});
