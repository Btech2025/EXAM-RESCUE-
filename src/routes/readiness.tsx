import { createFileRoute, Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  PriorityBadge,
  Progress,
  Ring,
  Stat,
} from "@/components/app/ui";
import { fmtMin, rankedTopics, readiness, todayISO, topicQuizAccuracy } from "@/lib/engine";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Readiness Report — Exam Rescue" },
      {
        name: "description",
        content: "Coverage, revision, quiz performance, strong and weak areas.",
      },
      { property: "og:title", content: "Readiness Report — Exam Rescue" },
      { property: "og:description", content: "An honest estimate of how ready you are." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Readiness,
});

function Readiness() {
  const s = useAppState();
  const today = todayISO();
  const r = readiness(s, today);
  if (!r)
    return (
      <EmptyState
        icon={<Gauge className="h-7 w-7" />}
        title="No data yet"
        text="Add an exam to see your readiness."
        action={
          <Link to="/exams" search={{ new: true }}>
            <Button>Add exam</Button>
          </Link>
        }
      />
    );
  const ranked = rankedTopics(s.exams, today);
  const acc = topicQuizAccuracy(s);
  const qa = (n: string) => acc[n.toLowerCase()];
  const ratio = (n: string) => {
    const a = qa(n);
    return a ? a.correct / a.total : null;
  };
  const strong = ranked.filter(
    ({ topic }) => topic.status === "Revised" || (ratio(topic.name) ?? 0) >= 0.8,
  );
  const weak = ranked.filter(
    ({ topic }) =>
      !strong.some((x) => x.topic.id === topic.id) &&
      ((ratio(topic.name) ?? 1) < 0.6 ||
        (topic.status === "Not Started" && topic.importance === "High")),
  );
  const urgent = ranked
    .filter((x) => x.info.level === "High" && x.topic.status !== "Revised")
    .slice(0, 5);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const recs = [
    urgent[0] &&
      `Start with ${urgent[0].topic.name} (${urgent[0].exam.subject}) — about ${fmtMin(urgent[0].minutes)} of focused study.`,
    weak.find((w) => qa(w.topic.name)) &&
      `Retake a quiz on ${weak.find((w) => qa(w.topic.name))!.topic.name} after reviewing it.`,
    !r.hasQuiz && "Take a practice quiz so quiz accuracy counts toward your score.",
    r.taskRate < 0.8 && "You've missed planned tasks — use Recover Missed Tasks in the planner.",
    r.revision < 0.3 && "Schedule short revision passes on topics you've already learned.",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Readiness Report"
        sub="An estimate from tracked progress and quiz results — not a guarantee of exam performance."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="flex flex-col items-center justify-center gap-3 bg-hero py-8 text-center">
          <Ring value={r.score} size={150} label="readiness" hero />
          <p className="max-w-xs text-xs text-purple-100 font-medium">
            {r.hasQuiz
              ? "45% coverage · 20% revision · 20% quiz accuracy · 15% task completion"
              : "55% coverage · 25% revision · 20% task completion"}
          </p>
        </Panel>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Stat
            label="Topic coverage"
            value={pct(r.coverage)}
            hint={<Progress value={r.coverage * 100} />}
          />
          <Stat
            label="Revision completion"
            value={pct(r.revision)}
            hint={<Progress value={r.revision * 100} tone="signal" />}
          />
          <Stat
            label="Quiz performance"
            value={r.hasQuiz ? pct(r.quiz) : "—"}
            hint={r.hasQuiz ? <Progress value={r.quiz * 100} tone="warning" /> : "No quizzes yet"}
          />
          <Stat
            label="Planned tasks done"
            value={pct(r.taskRate)}
            hint={<Progress value={r.taskRate * 100} tone="signal" />}
          />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Panel className="border-signal/20">
          <PanelTitle>Strong areas</PanelTitle>
          <ul className="space-y-2 text-sm">
            {strong.slice(0, 6).map((x) => (
              <li
                key={x.topic.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-signal/[0.04] px-2.5 py-1.5"
              >
                <span className="truncate text-foreground">{x.topic.name}</span>
                <span className="shrink-0 text-xs font-semibold text-signal">
                  {x.topic.status === "Revised" ? "Revised" : "Quiz ≥80%"}
                </span>
              </li>
            ))}
            {!strong.length && (
              <li className="py-2 text-center text-muted-foreground">None yet — keep going.</li>
            )}
          </ul>
        </Panel>
        <Panel className="border-warning/20">
          <PanelTitle>Weak areas</PanelTitle>
          <ul className="space-y-2 text-sm">
            {weak.slice(0, 6).map((x) => (
              <li
                key={x.topic.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-warning/[0.05] px-2.5 py-1.5"
              >
                <span className="truncate text-foreground">{x.topic.name}</span>
                <span className="shrink-0 text-xs font-semibold text-warning">
                  {qa(x.topic.name)
                    ? `Quiz ${qa(x.topic.name)?.correct}/${qa(x.topic.name)?.total}`
                    : "Not started"}
                </span>
              </li>
            ))}
            {!weak.length && (
              <li className="py-2 text-center text-muted-foreground">No weak areas detected.</li>
            )}
          </ul>
        </Panel>
        <Panel className="border-destructive/30">
          <PanelTitle>Urgent attention</PanelTitle>
          <ul className="space-y-2 text-sm">
            {urgent.map((x) => (
              <li
                key={x.topic.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-destructive/[0.04] px-2.5 py-1.5"
              >
                <span className="truncate text-foreground">{x.topic.name}</span>
                <PriorityBadge level={x.info.level} />
              </li>
            ))}
            {!urgent.length && (
              <li className="py-2 text-center text-muted-foreground">Nothing urgent.</li>
            )}
          </ul>
        </Panel>
      </div>
      <Panel>
        <PanelTitle>Next study session</PanelTitle>
        <ol className="space-y-3 text-sm">
          {recs.map((t, k) => (
            <li key={k} className="flex gap-3 rounded-lg bg-surface px-3 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                {k + 1}
              </span>
              <span className="text-foreground">{t}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/planner">
            <Button>Open planner</Button>
          </Link>
          <Link to="/practice">
            <Button variant="outline">Practice now</Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
