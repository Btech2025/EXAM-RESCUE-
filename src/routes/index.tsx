import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Calendar,
  CalendarClock,
  Clock,
  CheckCircle2,
  FileSearch,
  FileText,
  Flame,
  GraduationCap,
  Info,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Pencil,
  Plus,
  Sparkles,
  Siren,
  Target,
  Trash2,
  Upload,
  X,
  Loader2,
  Check,
  AlertCircle,
  FileEdit,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import {
  Badge,
  Button,
  CircularProgress,
  EmptyState,
  Panel,
  PanelTitle,
  PriorityBadge,
  Progress,
  Ring,
  Stat,
  Modal,
} from "@/components/app/ui";
import { spawnLocationMascot } from "@/lib/location-mascot";
import { TaskRow } from "@/components/app/TaskRow";
import {
  addDays,
  daysBetween,
  fmtMin,
  rankedTopics,
  readiness,
  todayISO,
  upcomingExams,
  weeklyMinutes,
  parseISO,
  uid,
} from "@/lib/engine";
import {
  extractSyllabusUnits,
  buildTopicsFromSelectedUnits,
  type ParsedUnit,
} from "@/lib/intelligence";
import { readPdf } from "@/lib/pdf";
import { actions, useAppState } from "@/lib/store";
import type { Exam, Topic } from "@/lib/types";
import { playCelebrationChime, playPopChime } from "@/lib/mascot-sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exam Rescue — AI Exam Preparation Copilot" },
      {
        name: "description",
        content:
          "Your exam is closer. Your next step is clearer. Drop your study material and we'll help you figure out what to study first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const target = parseISO(date).getTime() + 9 * 3600000;
  const diff = Math.max(0, target - now);
  const parts = [
    [Math.floor(diff / 86400000), "days"],
    [Math.floor((diff / 3600000) % 24), "hrs"],
    [Math.floor((diff / 60000) % 60), "min"],
    [Math.floor((diff / 1000) % 60), "sec"],
  ] as const;
  return (
    <div className="flex gap-2 sm:gap-3">
      {parts.map(([v, l]) => (
        <div
          key={l}
          className="min-w-[60px] rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur transition hover:bg-white/15"
        >
          <div className="font-mono text-2xl font-bold text-white sm:text-3xl">
            {String(v).padStart(2, "0")}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-100">{l}</div>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    text: "Drop your syllabus PDF. Archie extracts units and topics automatically with real browser analysis.",
  },
  {
    icon: FileSearch,
    title: "Prioritize",
    text: "Exam Rescue ranks topics by importance, difficulty, your progress and exam proximity.",
  },
  {
    icon: ListChecks,
    title: "Prepare",
    text: "Get a realistic day-by-day plan that fits your available hours. Check off tasks and conquer exams.",
  },
] as const;

const QUICK_ACTIONS = [
  {
    icon: Upload,
    label: "Syllabus Analyzer",
    sub: "Extract topics & weights",
    to: "/syllabus" as const,
  },
  {
    icon: FileSearch,
    label: "PYQ Research",
    sub: "Review past papers",
    to: "/pyq" as const,
  },
  {
    icon: ListChecks,
    label: "Study Planner",
    sub: "Day-by-day schedule",
    to: "/planner" as const,
  },
  {
    icon: GraduationCap,
    label: "My Exams",
    sub: "Manage dates & units",
    to: "/exams" as const,
  },
] as const;

function LandingHero() {
  return (
    <section className="relative overflow-x-clip rounded-2xl bg-hero px-6 py-16 sm:px-10 sm:py-20 lg:py-24 border border-purple-500/20 shadow-2xl">
      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/20 px-4 py-1.5 text-xs font-semibold text-purple-100 mb-6 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Your 3D Study Copilot is Ready</span>
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Conquer your exams without the panic.
        </h1>
        <p className="mt-4 text-base text-purple-100 font-medium sm:text-lg">
          Upload your syllabus PDF, select your exam units, and get a realistic day-by-day study
          schedule.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/exams">
            <Button variant="signal" size="lg" className="h-12 px-6">
              Add your first exam <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          How it works
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Three steps from overwhelmed to completely on track.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div
            key={title}
            className="panel group p-6 transition hover:shadow-lg hover:border-primary/40"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:scale-110 group-hover:bg-primary/25">
              <Icon className="h-6 w-6" />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">STEP {i + 1}</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Overview() {
  const s = useAppState();
  const nav = useNavigate();
  const today = todayISO();
  const [showCalc, setShowCalc] = useState(false);
  const heroCardRef = useRef<HTMLDivElement>(null);

  // Multi-subject switcher: "all" or specific exam id
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");

  // Modals for editing dates/hours and adding subjects
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState(3);

  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubDate, setNewSubDate] = useState(() => addDays(todayISO(), 14));
  const [newSubHours, setNewSubHours] = useState(3);
  const [newSubUnitCount, setNewSubUnitCount] = useState(4);
  const [newSubPdfName, setNewSubPdfName] = useState("");
  const [newSubPdfText, setNewSubPdfText] = useState("");
  const [newSubUnits, setNewSubUnits] = useState<ParsedUnit[]>([]);
  const [isExtractingNewPdf, setIsExtractingNewPdf] = useState(false);
  const [newSubExtractStage, setNewSubExtractStage] = useState("");
  const [newSubPdfError, setNewSubPdfError] = useState("");
  const [newSubShowManual, setNewSubShowManual] = useState(false);
  const [newSubManualText, setNewSubManualText] = useState("");
  const [editingModalUnitId, setEditingModalUnitId] = useState<string | null>(null);
  const [modalUnitTitleInput, setModalUnitTitleInput] = useState("");

  // Sync edit fields when an exam is opened for editing
  useEffect(() => {
    if (editingExam) {
      setEditDate(editingExam.date);
      setEditHours(editingExam.hoursPerDay);
    }
  }, [editingExam]);

  // Mascot welcome interaction on dashboard load
  useEffect(() => {
    const key = "exam-rescue:mascot-welcome-seen";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");

    const timer = setTimeout(() => {
      const rect = heroCardRef.current?.getBoundingClientRect();
      spawnLocationMascot({
        originRect: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : undefined,
        type: "welcome",
        title: "Archie",
        message: s.settings.name
          ? `Welcome back, ${s.settings.name}! Ready for your study mission? 🚀`
          : "Welcome! Ready for your study mission? 🚀",
        durationMs: 3200,
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [s.settings.name]);

  const upcoming = upcomingExams(s.exams, today);
  const next = upcoming[0];

  // Active exam for the single-subject view
  const activeExam =
    selectedSubjectId !== "all" ? s.exams.find((e) => e.id === selectedSubjectId) || next : next;

  // Filter tasks based on selected subject
  const allTasks = s.plan?.tasks ?? [];
  const subjectTasks =
    selectedSubjectId === "all" ? allTasks : allTasks.filter((t) => t.examId === selectedSubjectId);

  const todays = subjectTasks.filter((t) => t.date === today);
  const target = todays.reduce((a, t) => a + t.minutes, 0);
  const doneMin = todays.filter((t) => t.done).reduce((a, t) => a + t.minutes, 0);
  const todaysDone = todays.filter((t) => t.done).length;
  const todaysTotal = todays.length;
  const remainingMin = Math.max(0, target - doneMin);
  const targetPct = target ? Math.min(100, Math.round((doneMin / target) * 100)) : 0;

  const missed =
    subjectTasks.filter((t) => !t.done && t.date < today).length +
    (selectedSubjectId === "all"
      ? (s.plan?.unscheduled.length ?? 0)
      : (s.plan?.unscheduled ?? []).filter((t) => t.examId === selectedSubjectId).length);

  const r = readiness(s, today) || {
    score: 0,
    coverage: 0,
    revision: 0,
    quiz: 0,
    taskRate: 0,
    hasQuiz: false,
    topicCount: 0,
  };

  const prepPct = Math.round(r.coverage * 100);
  const week = weeklyMinutes(s, today);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const examName = (id: string) => s.exams.find((e) => e.id === id)?.subject ?? "";

  const rescue = () => {
    const res = actions.recover();
    toast.success(
      `Rescue plan ready: ${res.moved} task${res.moved === 1 ? "" : "s"} rescheduled.`,
      {
        description: res.overflow
          ? `${res.overflow} task(s) don't fit your available hours — check the planner.`
          : "Everything fits your available hours.",
      },
    );
    nav({ to: "/planner" });
  };

  // Handle saving edited exam date and hours
  const handleSaveExamEdit = () => {
    if (!editingExam) return;
    playCelebrationChime(true);

    const updated: Exam = {
      ...editingExam,
      date: editDate,
      hoursPerDay: editHours,
    };

    actions.saveExam(updated);
    actions.regenerate();

    toast.success(`Schedule updated for ${updated.subject}!`, {
      description: `New deadline: ${editDate} with ${editHours}h daily study time.`,
    });

    spawnLocationMascot({
      type: "action",
      title: "Archie Copilot",
      message: `Updated ${updated.subject} schedule! Recalculated your daily study missions! 🚀`,
      durationMs: 3000,
    });

    setEditingExam(null);
  };

  // Handle uploading PDF in Add Subject modal
  const handleNewPdfUpload = async (file: File) => {
    setIsExtractingNewPdf(true);
    setNewSubExtractStage("Reading syllabus PDF...");
    setNewSubPdfError("");
    setNewSubUnits([]); // Clear stale extracted units immediately
    playPopChime(true);
    try {
      const text = await readPdf(file, (stage) => {
        setNewSubExtractStage(stage);
      });
      const units = extractSyllabusUnits(text, newSubName || "New Subject", newSubUnitCount);
      setNewSubPdfName(file.name);
      setNewSubPdfText(text);
      setNewSubUnits(units);
      setNewSubUnitCount(units.filter((u) => u.selectedForExam).length);
      toast.success(`Extracted ${units.length} units from ${file.name}`);
      playCelebrationChime();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read PDF.";
      console.error("[Add Subject Modal PDF Error]", err);
      setNewSubPdfError(msg);
      setNewSubPdfName("");
      setNewSubPdfText("");
      setNewSubUnits([]);
      toast.error("Could not extract syllabus from PDF", { description: msg });
    } finally {
      setIsExtractingNewPdf(false);
      setNewSubExtractStage("");
    }
  };

  const handleNewManualSyllabus = () => {
    if (!newSubManualText.trim()) {
      setNewSubPdfError("Please enter your syllabus text or unit headings.");
      return;
    }
    try {
      const units = extractSyllabusUnits(
        newSubManualText,
        newSubName || "New Subject",
        newSubUnitCount,
      );
      setNewSubPdfName("Manual Syllabus Entry");
      setNewSubPdfText(newSubManualText);
      setNewSubUnits(units);
      setNewSubUnitCount(units.filter((u) => u.selectedForExam).length);
      setNewSubPdfError("");
      setNewSubShowManual(false);
      toast.success(`Extracted ${units.length} units from your syllabus text!`);
      playCelebrationChime();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse syllabus text.";
      setNewSubPdfError(msg);
      toast.error("Parsing failed", { description: msg });
    }
  };

  const toggleNewSubUnit = (unitNumber: number) => {
    playPopChime();
    setNewSubUnits((prev) =>
      prev.map((u) =>
        u.unitNumber === unitNumber ? { ...u, selectedForExam: !u.selectedForExam } : u,
      ),
    );
  };

  const handleUpdateModalUnitTitle = (unitId: string, newTitle: string) => {
    setNewSubUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        let updatedTopics = u.topics;
        if (updatedTopics.length === 0) {
          updatedTopics = [
            {
              id: `unit-${u.unitNumber}-topic-1-${uid()}`,
              name: newTitle,
              unit: u.unitLabel,
              unitNumber: u.unitNumber,
              subtopics: [newTitle],
              marks: "",
              objectives: "",
              difficulty: "Medium",
              importance: "High",
              status: "Not Started",
            },
          ];
        } else {
          updatedTopics = u.topics.map((t, idx) =>
            idx === 0 && t.name === u.title ? { ...t, name: newTitle } : t,
          );
        }
        const remainingNotes = u.flaggedNotes?.filter(
          (n) => !n.includes("was not detected") && !n.includes("Missing in scan"),
        );
        return {
          ...u,
          title: newTitle,
          topics: updatedTopics,
          flaggedNotes: remainingNotes && remainingNotes.length > 0 ? remainingNotes : undefined,
        };
      }),
    );
  };

  // Handle adding a new subject from dashboard modal
  const handleAddNewSubject = () => {
    if (!newSubName.trim()) {
      toast.error("Please enter a subject name.");
      return;
    }
    if (newSubUnits.length === 0) {
      toast.error(
        "Please upload a syllabus PDF or enter syllabus topics before adding this subject.",
      );
      return;
    }

    const selectedUnits = newSubUnits.filter((u) => u.selectedForExam);
    if (selectedUnits.length === 0) {
      toast.error("Please select at least one unit appearing on the exam.");
      return;
    }

    const emptyUnits = selectedUnits.filter((u) => u.topics.length === 0);
    if (emptyUnits.length > 0) {
      toast.error(
        `Please verify and enter topics for ${emptyUnits.map((u) => u.unitLabel).join(", ")} before adding this subject.`,
      );
      return;
    }

    playCelebrationChime(true);

    const examUnits = selectedUnits;
    const topics = buildTopicsFromSelectedUnits(examUnits);

    const newExam: Exam = {
      id: uid(),
      name: `${newSubName.trim()} Exam`,
      subject: newSubName.trim(),
      date: newSubDate,
      hoursPerDay: newSubHours,
      topics,
      includedUnits: examUnits.map((u) => u.unitNumber),
      totalUnitsInSyllabus: newSubUnits.length,
      syllabusFileName: newSubPdfName || undefined,
    };

    actions.saveExam(newExam);
    actions.regenerate();

    toast.success(`Added ${newExam.subject}!`, {
      description: `Plan generated with ${topics.length} topics across ${examUnits.length} exam units.`,
    });

    spawnLocationMascot({
      type: "action",
      title: "New Subject Ready",
      message: `Added ${newExam.subject}! Daily revision missions are now scheduled! 🦉✨`,
      durationMs: 3000,
    });

    // Reset & close
    setNewSubName("");
    setNewSubPdfName("");
    setNewSubPdfText("");
    setNewSubUnits([]);
    setNewSubPdfError("");
    setNewSubManualText("");
    setNewSubShowManual(false);
    setIsAddSubjectOpen(false);
    setSelectedSubjectId(newExam.id);
  };

  // Top priority topics (filtered)
  const top = rankedTopics(
    selectedSubjectId === "all" ? s.exams : s.exams.filter((e) => e.id === selectedSubjectId),
    today,
  )
    .filter((x) => x.topic.status !== "Revised")
    .slice(0, 3);

  // Fallback landing state if no exams yet
  if (!next) {
    return (
      <div className="space-y-12">
        <div ref={heroCardRef}>
          <LandingHero />
        </div>
        <HowItWorks />
        <Panel className="border-primary/20 bg-primary/[0.04]">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Ready to set up your subjects?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your exam dates and upload your syllabus to generate your personalized study
                plan.
              </p>
            </div>
            <Button
              variant="signal"
              onClick={() => {
                setIsAddSubjectOpen(true);
              }}
            >
              + Add Subject
            </Button>
          </div>
        </Panel>

        {/* Add Subject Modal */}
        <Modal
          open={isAddSubjectOpen}
          onClose={() => setIsAddSubjectOpen(false)}
          title="Add Exam Subject"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Subject Name
              </label>
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="e.g. Software Engineering"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Exam Date
                </label>
                <input
                  type="date"
                  value={newSubDate}
                  min={todayISO()}
                  onChange={(e) => setNewSubDate(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Daily Study Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={newSubHours}
                  onChange={(e) => setNewSubHours(parseFloat(e.target.value) || 2)}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <Button variant="signal" className="w-full mt-2" onClick={handleAddNewSubject}>
              Create Study Plan
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. MULTI-SUBJECT SWITCHER BAR (Requirement 5) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Subjects:</span>
          </span>

          {/* "All Subjects" Pill */}
          <button
            type="button"
            onClick={() => {
              playPopChime();
              setSelectedSubjectId("all");
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              selectedSubjectId === "all"
                ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25"
                : "bg-surface/80 border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            All Subjects ({s.exams.length})
          </button>

          {/* Individual Subject Pills */}
          {s.exams.map((exam) => {
            const daysLeft = Math.max(0, daysBetween(todayISO(), exam.date));
            const isSelected = selectedSubjectId === exam.id;

            return (
              <button
                key={exam.id}
                type="button"
                onClick={() => {
                  playPopChime();
                  setSelectedSubjectId(exam.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-surface/80 border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <span>{exam.subject}</span>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {daysLeft}d left
                </span>
              </button>
            );
          })}
        </div>

        {/* "+ Add Subject" Quick Action */}
        <button
          type="button"
          onClick={() => {
            playPopChime(true);
            setIsAddSubjectOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary transition shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* ── 2. MISSION CONTROL HERO ── */}
      <div ref={heroCardRef}>
        <Panel className="bg-hero animate-card relative overflow-visible p-6 sm:p-8 border border-purple-500/30 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-100">
                {greet}
                {s.settings.name ? `, ${s.settings.name}` : ""}.{" "}
                {selectedSubjectId === "all" ? "Next upcoming exam:" : "Selected subject focus:"}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{activeExam.subject}</h1>

                {/* Edit Date & Hours Button */}
                <button
                  type="button"
                  onClick={() => setEditingExam(activeExam)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-purple-200 hover:text-white transition"
                  title="Edit Exam Date and Available Hours"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit Date & Hours</span>
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-purple-100/90">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 text-purple-300" />
                  {parseISO(activeExam.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>

                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs">
                  <Clock className="h-3.5 w-3.5 text-purple-300" />
                  {activeExam.hoursPerDay}h daily target
                </span>

                {activeExam.includedUnits && activeExam.includedUnits.length > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {activeExam.includedUnits.length} exam units included
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/rescue"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    spawnLocationMascot({
                      originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                      type: "navigation",
                      title: "Rescue Mode",
                      message: "Let’s rescue this exam! Focusing on highest-yield units! 🚨✨",
                      durationMs: 2500,
                    });
                  }}
                >
                  <Button variant="signal" size="lg" className="h-12 px-6 text-sm">
                    <Siren className="h-4 w-4" /> Start Rescue Mode
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    spawnLocationMascot({
                      originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                      type: "action",
                      title: "Recover Missed",
                      message: "Rescheduling missed sessions across your remaining days! ⚡",
                      durationMs: 2500,
                    });
                    rescue();
                  }}
                >
                  <LifeBuoy className="h-4 w-4" /> Recover missed
                  {missed > 0 && (
                    <span className="rounded-md bg-white/15 px-1.5 text-xs ml-1">{missed}</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Countdown Clock + Archie Summon */}
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <Countdown date={activeExam.date} />

              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  spawnLocationMascot({
                    originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    type: "action",
                    title: "Archie Copilot",
                    message:
                      prepPct < 50
                        ? `You're ${prepPct}% prepared! Focus on high-yield core units to boost marks fast! ⚡`
                        : `Awesome consistency (${prepPct}% prepared)! Keep this incredible pace! ⭐`,
                    durationMs: 2800,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-white/10 hover:border-white/30 hover:scale-105 active:scale-95"
                title="Summon Archie for study advice"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Archie Copilot</span>
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── 3. SYLLABUS UNITS BREAKDOWN (When viewing a specific subject or all) ── */}
      {activeExam.topics && activeExam.topics.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Syllabus & Units Breakdown: {activeExam.subject}
              </h3>
            </div>
            <span className="text-xs text-primary font-semibold">
              {activeExam.topics.length} topics total
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Group topics by unit */}
            {Array.from(new Set(activeExam.topics.map((t) => t.unit || "Unit 1"))).map(
              (unitLabel) => {
                const unitTopics = activeExam.topics.filter(
                  (t) => (t.unit || "Unit 1") === unitLabel,
                );
                const revised = unitTopics.filter((t) => t.status === "Revised").length;
                const unitPct = Math.round((revised / unitTopics.length) * 100);

                return (
                  <div
                    key={unitLabel}
                    className="rounded-xl border border-border/60 bg-surface/50 p-3 transition hover:border-primary/40 hover:bg-surface/80 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-primary">{unitLabel}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {revised}/{unitTopics.length} revised
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-foreground truncate mb-2">
                      {unitTopics[0]?.name || "Core Topics"}
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-signal rounded-full transition-all duration-500"
                        style={{ width: `${unitPct}%` }}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* ── 4. STATS ROW ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Daily study goal"
          icon={<Target className="h-4 w-4 text-purple-400" />}
          value={
            <span>
              {fmtMin(doneMin)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {fmtMin(target)}
              </span>
            </span>
          }
          progress={targetPct}
          hint={
            target > 0
              ? remainingMin === 0
                ? "🎉 Daily study goal reached!"
                : `${fmtMin(remainingMin)} remaining · ${todaysTotal - todaysDone} task(s) left`
              : "No tasks scheduled today"
          }
        />
        <div className="panel group flex items-center justify-between gap-3 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span>Preparation</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-foreground">{prepPct}%</div>
            <div className="mt-1.5 truncate text-xs text-muted-foreground">
              {r.topicCount} topics weighted by importance
            </div>
          </div>
          <CircularProgress value={prepPct} size={68} strokeWidth={6} tone="primary" />
        </div>
        <Stat
          label="Tasks done"
          icon={<ListChecks className="h-4 w-4 text-primary" />}
          value={`${todaysDone}/${todaysTotal}`}
          progress={todaysTotal ? Math.round((todaysDone / todaysTotal) * 100) : 0}
          hint={target ? `${targetPct}% of today's study minutes` : "No tasks today"}
        />
        <Stat
          label="Readiness"
          icon={<Flame className="h-4 w-4 text-warning" />}
          value={`${r.score}`}
          progress={r.score}
          hint={r.hasQuiz ? "Includes quiz accuracy" : "Take a quiz to refine"}
        />
      </div>

      {/* ── 5. PROGRESS + READINESS RING ── */}
      <div className="grid gap-5 md:grid-cols-3">
        <Panel className="md:col-span-2">
          <PanelTitle
            action={
              <Link to="/planner" className="text-xs text-primary hover:underline font-semibold">
                Full planner →
              </Link>
            }
          >
            Today&apos;s study mission
          </PanelTitle>
          {todays.length ? (
            <>
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {fmtMin(doneMin)} completed{" "}
                    <span className="font-normal text-muted-foreground">
                      of {fmtMin(target)} goal
                    </span>
                  </span>
                  <span className="font-mono font-bold text-signal">{targetPct}%</span>
                </div>
                <Progress value={targetPct} tone="signal" />
                {target > 0 && remainingMin > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {fmtMin(remainingMin)} remaining to finish today&apos;s mission
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {todays.map((t) => (
                  <TaskRow key={t.id} task={t} sub={examName(t.examId)} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
              No tasks for today.{" "}
              <button
                className="text-primary hover:underline font-semibold"
                onClick={() => {
                  actions.regenerate();
                  toast.success("Study plan generated");
                }}
              >
                Generate a plan
              </button>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            action={
              <button
                onClick={() => setShowCalc((v) => !v)}
                className="text-muted-foreground transition hover:text-foreground"
                aria-label="How readiness is calculated"
              >
                <Info className="h-4 w-4" />
              </button>
            }
          >
            Readiness score
          </PanelTitle>
          <div className="flex flex-col items-center gap-3">
            <Ring value={r.score} size={120} label="readiness" />
            <div className="text-center text-xs text-muted-foreground">
              {showCalc ? (
                <p>
                  {r.hasQuiz
                    ? "45% coverage + 20% revision + 20% quiz accuracy + 15% task completion."
                    : "55% coverage + 25% revision + 20% task completion. Take a quiz to include practice."}
                </p>
              ) : (
                <p>
                  An estimate from your tracked progress — not a guarantee.{" "}
                  <Link to="/readiness" className="text-primary hover:underline">
                    See report
                  </Link>
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── 6. PRIORITY TOPICS & QUICK ACTIONS ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelTitle
            action={
              <Link to="/topics" className="text-xs text-primary hover:underline font-semibold">
                All topics →
              </Link>
            }
          >
            Study next — priority topics
          </PanelTitle>
          <div className="space-y-3">
            {top.map(({ topic, exam, info, minutes }, i) => (
              <div
                key={topic.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface/60 p-3 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.70_0.15_285)] font-mono text-sm font-bold text-white shadow-sm">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{topic.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {exam.subject} · {topic.unit ? `${topic.unit} · ` : ""}~{fmtMin(minutes)}
                  </div>
                  <div className="mt-1.5">
                    <PriorityBadge level={info.level} />
                  </div>
                </div>
              </div>
            ))}
            {!top.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Every topic is revised. Great work!
              </p>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle>Quick actions</PanelTitle>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map(({ icon: Icon, label, sub, to }) => (
              <Link
                key={label}
                to={to}
                className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/50 p-3 transition hover:border-primary/40 hover:bg-surface/90 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-110 group-hover:bg-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── 7. WEEKLY CONSISTENCY CHART ── */}
      <Panel>
        <PanelTitle
          action={
            <span className="flex items-center gap-1 text-xs font-semibold text-signal">
              <Flame className="h-3.5 w-3.5" />
              {week.filter((d) => d.minutes > 0).length}/7 active days
            </span>
          }
        >
          Weekly consistency
        </PanelTitle>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week}>
              <XAxis
                dataKey="day"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(124, 58, 237, 0.06)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                }}
                formatter={(v: number) => [fmtMin(v), "Studied"]}
              />
              <Bar dataKey="minutes" fill="var(--primary)" radius={[6, 6, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* ── MODAL: EDIT EXAM DATE & STUDY HOURS (Requirement 5) ── */}
      <Modal
        open={editingExam !== null}
        onClose={() => setEditingExam(null)}
        title={editingExam ? `Edit Schedule: ${editingExam.subject}` : "Edit Schedule"}
      >
        {editingExam && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Update your exam date or daily study target. Archie will immediately recalculate your
              preparation schedule!
            </p>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Exam Date
              </label>
              <input
                type="date"
                required
                value={editDate}
                min={todayISO()}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-300">
                <span>In {Math.max(0, daysBetween(todayISO(), editDate))} days</span>
                <div className="flex gap-1.5">
                  {[7, 14, 21, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditDate(addDays(todayISO(), d))}
                      className="px-2 py-0.5 rounded bg-surface border border-border/50 hover:bg-surface/80 text-foreground text-[10px] font-semibold"
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Available Study Hours Per Day ({editHours}h)
              </label>
              <div className="flex items-center gap-2">
                {[1.5, 2, 3, 4, 5, 6].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setEditHours(h)}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-lg border transition-all",
                      editHours === h
                        ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "bg-surface/70 border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingExam(null)}>
                Cancel
              </Button>
              <Button variant="signal" onClick={handleSaveExamEdit}>
                Save & Recalculate Plan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: ADD ANOTHER SUBJECT (Requirement 5) ── */}
      <Modal
        open={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        title="Add Another Subject"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Add a subject with its exam date and syllabus to expand your study mission. Only your
            real syllabus topics are scheduled.
          </p>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Subject Name
            </label>
            <input
              type="text"
              required
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="e.g. Operating Systems"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Exam Date
              </label>
              <input
                type="date"
                required
                value={newSubDate}
                min={todayISO()}
                onChange={(e) => setNewSubDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Daily Study Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                value={newSubHours}
                onChange={(e) => setNewSubHours(parseFloat(e.target.value) || 2)}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Upload Syllabus PDF / Manual Entry */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Upload Syllabus PDF
              </label>
              <button
                type="button"
                onClick={() => setNewSubShowManual((prev) => !prev)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <FileEdit className="h-3 w-3" />
                <span>{newSubShowManual ? "Hide manual entry" : "Or paste syllabus text"}</span>
              </button>
            </div>

            <div className="relative rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] p-3 text-center transition hover:border-primary/60">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleNewPdfUpload(f);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {isExtractingNewPdf ? (
                <div className="flex items-center justify-center gap-2 text-primary text-xs py-1">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{newSubExtractStage || "Extracting syllabus units..."}</span>
                </div>
              ) : newSubPdfName ? (
                <div className="flex items-center justify-between text-left text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold text-foreground truncate block">
                        {newSubPdfName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {newSubUnits.length} units extracted (
                        {newSubUnits.filter((u) => u.selectedForExam).length} selected)
                      </span>
                    </div>
                  </div>
                  <span className="text-primary underline text-[11px] font-medium shrink-0">
                    Replace PDF
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-1 text-xs">
                  <Upload className="h-4 w-4 text-primary mb-1" />
                  <span className="text-foreground font-medium">Click or drop syllabus PDF</span>
                  <span className="text-[10px] text-muted-foreground">Text-based PDF files</span>
                </div>
              )}
            </div>

            {/* PDF Error Display */}
            {newSubPdfError && (
              <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{newSubPdfError}</p>
                  {!newSubShowManual && (
                    <button
                      type="button"
                      onClick={() => setNewSubShowManual(true)}
                      className="mt-1 inline-flex items-center gap-1 font-bold underline hover:opacity-85 text-[11px]"
                    >
                      <FileEdit className="h-3 w-3" />
                      <span>Paste syllabus text manually instead</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Manual Text Drawer */}
            {newSubShowManual && (
              <div className="mt-2 rounded-xl border border-primary/30 bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-foreground">Paste Syllabus Text</span>
                  <span className="text-[10px] text-muted-foreground">Unit headings & topics</span>
                </div>
                <textarea
                  rows={4}
                  value={newSubManualText}
                  onChange={(e) => setNewSubManualText(e.target.value)}
                  placeholder={`UNIT 1: Process Management\nProcess scheduling, Deadlocks, Threads\n\nUNIT 2: Memory Management\nPaging, Virtual memory, Segmentation`}
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setNewSubShowManual(false)}>
                    Cancel
                  </Button>
                  <Button variant="signal" size="sm" onClick={handleNewManualSyllabus}>
                    Extract Units
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Extracted Units */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Confirm Units Appearing On Exam
              </label>
              {newSubUnits.length > 0 && (
                <span className="text-[11px] font-semibold text-primary">
                  {newSubUnits.filter((u) => u.selectedForExam).length} of {newSubUnits.length}{" "}
                  selected
                </span>
              )}
            </div>

            {newSubUnits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-surface/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Upload a syllabus PDF or paste text above to extract and confirm your exam units.
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {newSubUnits.map((unit) => (
                  <div
                    key={unit.id}
                    onClick={() => toggleNewSubUnit(unit.unitNumber)}
                    className={cn(
                      "cursor-pointer flex flex-col gap-1.5 p-2 rounded-lg border text-xs transition",
                      unit.selectedForExam
                        ? "bg-primary/10 border-primary/40 text-foreground"
                        : "bg-surface/40 border-border/40 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {editingModalUnitId === unit.id ? (
                        <div
                          className="flex items-center gap-1.5 flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-bold text-primary shrink-0">{unit.unitLabel}:</span>
                          <input
                            type="text"
                            value={modalUnitTitleInput}
                            onChange={(e) => setModalUnitTitleInput(e.target.value)}
                            className="flex-1 rounded border border-primary/50 bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateModalUnitTitle(
                                unit.id,
                                modalUnitTitleInput.trim() || unit.title,
                              );
                              setEditingModalUnitId(null);
                              playPopChime(true);
                              toast.success("Unit updated");
                            }}
                            className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingModalUnitId(null)}
                            className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              unit.selectedForExam
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input bg-card",
                            )}
                          >
                            {unit.selectedForExam && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="font-bold text-primary shrink-0">{unit.unitLabel}:</span>
                          <span className="truncate flex-1 font-medium">{unit.title}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingModalUnitId(unit.id);
                              setModalUnitTitleInput(unit.title);
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition"
                            title="Edit unit title"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0",
                          unit.selectedForExam
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {unit.selectedForExam ? "On Exam" : "Excluded"}
                      </span>
                    </div>

                    {/* Course Outcomes & Scan Alerts */}
                    {(unit.courseOutcomes || unit.flaggedNotes) && (
                      <div className="pl-6 flex flex-wrap items-center gap-1.5">
                        {unit.courseOutcomes?.map((co) => (
                          <span
                            key={co}
                            className="inline-flex items-center text-[9px] font-bold px-1 py-0.2 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25"
                          >
                            🎯 {co}
                          </span>
                        ))}
                        {unit.flaggedNotes && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            <span>Scan noise flagged</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border/60">
            <Button variant="ghost" onClick={() => setIsAddSubjectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="signal"
              onClick={handleAddNewSubject}
              disabled={newSubUnits.length === 0}
            >
              Add Subject & Update Plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
