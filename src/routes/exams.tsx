import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  StatusBadge,
  inputCls,
} from "@/components/app/ui";
import { addDays, daysBetween, fmtDay, todayISO, uid } from "@/lib/engine";
import { actions, useAppState } from "@/lib/store";
import type { Difficulty, Exam, Importance, Status, Topic } from "@/lib/types";

export const Route = createFileRoute("/exams")({
  validateSearch: (s: Record<string, unknown>): { new?: boolean } =>
    s["new"] === true || s["new"] === "true" ? { new: true } : {},
  head: () => ({
    meta: [
      { title: "My Exams — Exam Rescue" },
      { name: "description", content: "Add, edit and delete exams and syllabus topics." },
      { property: "og:title", content: "My Exams — Exam Rescue" },
      {
        property: "og:description",
        content: "Set up exams, dates, study hours and syllabus topics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

const blankTopic = (): Topic => ({
  id: uid(),
  name: "",
  difficulty: "Medium",
  importance: "Medium",
  status: "Not Started",
});

function ExamForm({ initial, onDone }: { initial: Exam | null; onDone: () => void }) {
  const [f, setF] = useState<Exam>(
    initial ?? {
      id: uid(),
      name: "",
      subject: "",
      date: addDays(todayISO(), 7),
      hoursPerDay: 2,
      topics: [blankTopic()],
    },
  );
  const [err, setErr] = useState<
    Partial<Record<"name" | "subject" | "date" | "hours" | "topics", string>>
  >({});

  const setTopic = (id: string, p: Partial<Topic>) =>
    setF({ ...f, topics: f.topics.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Partial<Record<"name" | "subject" | "date" | "hours" | "topics", string>> = {};
    if (!f.name.trim()) er.name = "Give the exam a name.";
    else if (f.name.length > 60) er.name = "Keep it under 60 characters.";
    if (!f.subject.trim()) er.subject = "Subject is required.";
    if (!f.date) er.date = "Pick a date.";
    else if (f.date <= todayISO()) er.date = "Exam date must be in the future.";
    if (!(f.hoursPerDay >= 0.5 && f.hoursPerDay <= 16))
      er.hours = "Enter between 0.5 and 16 hours.";
    const topics = f.topics.filter((t) => t.name.trim());
    if (!topics.length) er.topics = "Add at least one topic.";
    const names = topics.map((t) => t.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) er.topics = "Topic names must be unique.";
    setErr(er);
    if (Object.keys(er).length) return;
    actions.saveExam({
      ...f,
      name: f.name.trim(),
      subject: f.subject.trim(),
      topics: topics.map((t) => ({ ...t, name: t.name.trim() })),
    });
    toast.success(initial ? "Exam updated" : "Exam added", {
      description: "Regenerate your plan to include the changes.",
      action: {
        label: "Generate plan",
        onClick: () => {
          actions.regenerate();
          toast.success("Study plan regenerated");
        },
      },
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exam name" error={err.name}>
          <input
            className={inputCls}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="e.g. CS201 Mid-Semester"
          />
        </Field>
        <Field label="Subject" error={err.subject}>
          <input
            className={inputCls}
            value={f.subject}
            onChange={(e) => setF({ ...f, subject: e.target.value })}
            placeholder="e.g. Data Structures"
          />
        </Field>
        <Field label="Exam date" error={err.date}>
          <input
            type="date"
            className={inputCls}
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </Field>
        <Field label="Study hours available per day" error={err.hours}>
          <input
            type="number"
            step="0.5"
            className={inputCls}
            value={f.hoursPerDay}
            onChange={(e) => setF({ ...f, hoursPerDay: parseFloat(e.target.value) })}
          />
        </Field>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Syllabus topics</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setF({ ...f, topics: [...f.topics, blankTopic()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add topic
          </Button>
        </div>
        <div className="space-y-2">
          {f.topics.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-2 gap-2 rounded-lg border border-input bg-card p-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            >
              <input
                className={`${inputCls} col-span-2 sm:col-span-1`}
                value={t.name}
                placeholder="Topic name"
                onChange={(e) => setTopic(t.id, { name: e.target.value })}
              />
              <select
                className={inputCls}
                value={t.difficulty}
                onChange={(e) => setTopic(t.id, { difficulty: e.target.value as Difficulty })}
                aria-label="Difficulty"
              >
                {["Easy", "Medium", "Hard"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                className={inputCls}
                value={t.importance}
                onChange={(e) => setTopic(t.id, { importance: e.target.value as Importance })}
                aria-label="Importance"
              >
                {["Low", "Medium", "High"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                className={inputCls}
                value={t.status}
                onChange={(e) => setTopic(t.id, { status: e.target.value as Status })}
                aria-label="Status"
              >
                {["Not Started", "Learning", "Revised"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setF({ ...f, topics: f.topics.filter((x) => x.id !== t.id) })}
                aria-label="Remove topic"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {err.topics && <p className="mt-2 text-xs text-destructive">{err.topics}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Columns: difficulty · importance · current preparation level
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{initial ? "Save changes" : "Add exam"}</Button>
      </div>
    </form>
  );
}

function ExamsPage() {
  const s = useAppState();
  const search = Route.useSearch();
  const nav = useNavigate();
  const [editing, setEditing] = useState<Exam | null | "new">(null);
  const today = todayISO();
  useEffect(() => {
    if (search.new) {
      setEditing("new");
      nav({ to: "/exams", search: {}, replace: true });
    }
  }, [search.new, nav]);
  const close = () => setEditing(null);
  const exams = [...s.exams].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader
        title="My Exams"
        sub="Your exams and syllabus. Everything else is calculated from here."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Add exam
          </Button>
        }
      />
      {!exams.length ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" />}
          title="No exams yet"
          text="Add an exam with its topics to get a prioritized study plan."
          action={<Button onClick={() => setEditing("new")}>Add exam</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {exams.map((e) => {
            const d = daysBetween(today, e.date);
            const revised = e.topics.filter((t) => t.status === "Revised").length;
            return (
              <Panel key={e.id} className="animate-list transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-foreground">{e.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge tone="violet">{e.subject}</Badge>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmtDay(e.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {e.hoursPerDay}h/day
                      </span>
                    </div>
                  </div>
                  <Badge
                    tone={d < 0 ? "muted" : d <= 3 ? "red" : d <= 7 ? "amber" : "lime"}
                    className="shrink-0"
                  >
                    {d < 0 ? "Finished" : d === 0 ? "Today" : `${d}d left`}
                  </Badge>
                </div>
                {e.topics.length > 0 && (
                  <div className="mt-3 mb-1">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Topics revised</span>
                      <span className="font-mono">
                        {revised}/{e.topics.length}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-signal transition-all duration-500"
                        style={{ width: `${(revised / e.topics.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-3 space-y-1">
                  {e.topics.map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-surface"
                    >
                      <span className="truncate text-foreground">{t.name}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="hidden text-[11px] text-muted-foreground sm:inline">
                          {t.difficulty} · {t.importance}
                        </span>
                        <StatusBadge status={t.status} />
                        <button
                          onClick={() => {
                            actions.deleteTopic(e.id, t.id);
                            toast("Topic removed");
                          }}
                          className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                          aria-label={`Delete ${t.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(e)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete ${e.name}?`)) {
                        actions.deleteExam(e.id);
                        toast("Exam deleted");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      <Modal
        open={editing !== null}
        onClose={close}
        title={editing === "new" ? "Add exam" : "Edit exam"}
      >
        {editing !== null && (
          <ExamForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            onDone={close}
          />
        )}
      </Modal>
    </div>
  );
}
