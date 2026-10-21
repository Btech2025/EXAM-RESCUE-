import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ListChecks, RefreshCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  Progress,
  Stat,
  inputCls,
} from "@/components/app/ui";
import { TaskRow } from "@/components/app/TaskRow";
import { fmtDay, fmtMin, todayISO, upcomingExams } from "@/lib/engine";
import { actions, useAppState } from "@/lib/store";
import type { Status, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Study Planner — Exam Rescue" },
      {
        name: "description",
        content: "A realistic day-by-day study schedule that respects your available hours.",
      },
      { property: "og:title", content: "Study Planner — Exam Rescue" },
      { property: "og:description", content: "Generate, complete and recover your study plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Planner,
});

function Planner() {
  const s = useAppState();
  const today = todayISO();
  const exams = upcomingExams(s.exams, today);
  if (!exams.length)
    return (
      <EmptyState
        icon={<ListChecks className="h-7 w-7" />}
        title="Nothing to plan yet"
        text="Add an upcoming exam with topics first."
        action={
          <Link to="/exams" search={{ new: true }}>
            <Button>Add exam</Button>
          </Link>
        }
      />
    );

  const tasks = s.plan?.tasks ?? [];
  const missed = tasks.filter((t) => !t.done && t.date < today);
  const future = tasks.filter((t) => t.date >= today);
  const days = Array.from(new Set(future.map((t) => t.date))).sort();
  const cap = (d: string) =>
    Math.max(0, ...s.exams.filter((e) => e.date > d).map((e) => e.hoursPerDay * 60));
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const unsched = s.plan?.unscheduled ?? [];
  const subj = (t: Task) => s.exams.find((e) => e.id === t.examId)?.subject;

  const regen = () => {
    const w = actions.regenerate();
    if (w) toast.warning(`Plan regenerated — ${w} task(s) don't fit your hours.`);
    else toast.success("Plan regenerated within your available hours.");
  };
  const recover = () => {
    const r = actions.recover();
    toast.success(`${r.moved} task(s) redistributed across remaining days.`, {
      description: r.overflow
        ? `${r.overflow} still don't fit — consider adding study hours.`
        : undefined,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Study Planner"
        sub="Scheduled by priority, never beyond your daily hours."
        action={
          <>
            <Button variant="outline" onClick={regen}>
              <RefreshCw className="h-4 w-4" />
              Regenerate plan
            </Button>
            <Button variant="signal" onClick={recover} disabled={!missed.length && !unsched.length}>
              <Undo2 className="h-4 w-4" />
              Recover missed ({missed.length + unsched.length})
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Tasks done"
          value={`${done}/${total}`}
          hint={<Progress value={total ? (done / total) * 100 : 0} tone="signal" />}
        />
        <Stat label="Missed" value={missed.length} hint="Past and unfinished" />
        <Stat
          label="Remaining time"
          value={fmtMin(future.filter((t) => !t.done).reduce((a, t) => a + t.minutes, 0))}
        />
        <Stat label="Study days" value={days.length} />
      </div>

      {unsched.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-warning">Syllabus too large for your available time</p>
            <p className="mt-1 text-muted-foreground">
              {unsched.length} task(s) ({fmtMin(unsched.reduce((a, t) => a + t.minutes, 0))})
              couldn't be scheduled without exceeding your daily hours. Increase hours per day in My
              Exams, or focus on high-priority topics. Unscheduled:{" "}
              {unsched
                .slice(0, 4)
                .map((t) => t.title)
                .join(", ")}
              {unsched.length > 4 ? "…" : ""}
            </p>
          </div>
        </div>
      )}

      {!s.plan && (
        <Panel className="text-center">
          <p className="mb-3 text-sm text-muted-foreground">No plan generated yet.</p>
          <Button onClick={regen}>Generate my plan</Button>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {missed.length > 0 && (
            <Panel className="border-destructive/30">
              <PanelTitle>Missed tasks</PanelTitle>
              <div className="space-y-2">
                {missed.map((t) => (
                  <TaskRow key={t.id} task={t} sub={`${subj(t)} · was ${fmtDay(t.date)}`} />
                ))}
              </div>
            </Panel>
          )}
          {days.map((d) => {
            const list = future.filter((t) => t.date === d);
            const used = list.reduce((a, t) => a + t.minutes, 0);
            const c = cap(d);
            const isToday = d === today;
            const dayDone = list.filter((t) => t.done).length;
            return (
              <Panel key={d} className={cn(isToday && "border-primary/30 shadow-sm")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isToday ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[oklch(0.70_0.15_285)] px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm">
                        Today
                      </span>
                    ) : (
                      <h3 className="font-semibold text-foreground">{fmtDay(d)}</h3>
                    )}
                    {dayDone === list.length && list.length > 0 && (
                      <span className="text-xs font-semibold text-signal">All done</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      used > c ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {fmtMin(used)} / {fmtMin(c)}
                  </span>
                </div>
                <div className="mb-3">
                  <Progress
                    value={
                      c
                        ? (list.filter((t) => t.done).reduce((a, t) => a + t.minutes, 0) / c) * 100
                        : 0
                    }
                    tone="signal"
                  />
                </div>
                <div className="space-y-2">
                  {list.map((t, i) => (
                    <div
                      key={t.id}
                      className="animate-list"
                      style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                    >
                      <TaskRow task={t} sub={subj(t)} />
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
        <Panel className="h-fit lg:sticky lg:top-6">
          <PanelTitle>Topic status</PanelTitle>
          <div className="space-y-4">
            {exams.map((e) => (
              <div key={e.id}>
                <div className="mb-2 text-xs font-semibold text-primary">{e.subject}</div>
                <div className="space-y-1.5">
                  {e.topics.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{t.name}</span>
                      <select
                        className={`${inputCls} h-8 w-32 text-xs`}
                        value={t.status}
                        onChange={(ev) => {
                          actions.setTopicStatus(t.id, ev.target.value as Status);
                          toast.success(`${t.name} marked ${ev.target.value}`);
                        }}
                      >
                        {["Not Started", "Learning", "Revised"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
