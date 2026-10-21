import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PriorityBadge,
  StatusBadge,
  inputCls,
} from "@/components/app/ui";
import { fmtMin, rankedTopics, todayISO } from "@/lib/engine";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/topics")({
  head: () => ({
    meta: [
      { title: "Topic Intelligence — Exam Rescue" },
      {
        name: "description",
        content:
          "Transparent topic prioritization by exam proximity, importance, difficulty and status.",
      },
      { property: "og:title", content: "Topic Intelligence — Exam Rescue" },
      { property: "og:description", content: "See exactly why each topic is recommended." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Topics,
});

function Topics() {
  const s = useAppState();
  const today = todayISO();
  const all = rankedTopics(s.exams, today);
  const [p, setP] = useState("All");
  const [st, setSt] = useState("All");
  const [sub, setSub] = useState("All");
  if (!all.length)
    return (
      <EmptyState
        icon={<Brain className="h-7 w-7" />}
        title="No topics to analyse"
        text="Add an exam with syllabus topics."
        action={
          <Link to="/exams" search={{ new: true }}>
            <Button>Add exam</Button>
          </Link>
        }
      />
    );
  const subjects = Array.from(new Set(all.map((x) => x.exam.subject)));
  const list = all.filter(
    (x) =>
      (p === "All" || x.info.level === p) &&
      (st === "All" || x.topic.status === st) &&
      (sub === "All" || x.exam.subject === sub),
  );

  return (
    <div>
      <PageHeader
        title="Topic Intelligence"
        sub="Priority = importance + difficulty + preparation gap + exam proximity. No black-box scores."
      />
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <select
          className={inputCls}
          value={p}
          onChange={(e) => setP(e.target.value)}
          aria-label="Priority"
        >
          {["All", "High", "Medium", "Low"].map((x) => (
            <option key={x} value={x}>
              {x === "All" ? "All priorities" : `${x} priority`}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={st}
          onChange={(e) => setSt(e.target.value)}
          aria-label="Status"
        >
          {["All", "Not Started", "Learning", "Revised"].map((x) => (
            <option key={x} value={x}>
              {x === "All" ? "All statuses" : x}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          aria-label="Subject"
        >
          {["All", ...subjects].map((x) => (
            <option key={x} value={x}>
              {x === "All" ? "All subjects" : x}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(({ topic, exam, info, minutes }, i) => (
          <Panel
            key={topic.id}
            className="animate-list relative overflow-hidden transition hover:border-primary/40 hover:shadow-md"
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            <div
              className={cn(
                "absolute left-0 top-0 h-full w-1",
                info.level === "High"
                  ? "bg-destructive"
                  : info.level === "Medium"
                    ? "bg-warning"
                    : "bg-muted-foreground/40",
              )}
            />
            <div className="flex items-start justify-between gap-2 pl-2">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 font-mono text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground">{topic.name}</h3>
                  <p className="text-xs text-muted-foreground">{exam.subject}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold text-primary">{info.score}</div>
                <div className="text-[10px] text-muted-foreground">/ 29</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
              <PriorityBadge level={info.level} />
              <StatusBadge status={topic.status} />
              <Badge>{topic.difficulty}</Badge>
              <Badge tone="lime">~{fmtMin(minutes)}</Badge>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-surface p-3 pl-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Why this priority
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {info.reasons.map((r) => (
                  <li key={r} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </div>
      {!list.length && (
        <p className="text-center text-sm text-muted-foreground">No topics match these filters.</p>
      )}
    </div>
  );
}
