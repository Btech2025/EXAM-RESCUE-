import { useState, useEffect } from "react";
import {
  Sparkles,
  Star,
  Calendar,
  Clock,
  BookOpen,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Loader2,
  Sun,
  Moon,
  FileEdit,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCurrentUser, updateUserProfile } from "@/lib/auth";
import { actions } from "@/lib/store";
import { addDays, daysBetween, todayISO, uid } from "@/lib/engine";
import {
  extractSyllabusUnits,
  buildTopicsFromSelectedUnits,
  type ParsedUnit,
  type SyllabusTopic,
} from "@/lib/intelligence";
import { readSyllabusDoc } from "@/lib/pdf";
import type { Exam } from "@/lib/types";
import { playCelebrationChime, playPopChime, playEntranceChime } from "@/lib/mascot-sound";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { MagicalBackground } from "./MagicalBackground";

interface SubjectDraft {
  id: string;
  subjectName: string;
  examDate: string;
  hoursPerDay: number;
  unitCount: number;
  docFileName?: string;
  isReadingDoc?: boolean;
  syllabusText: string;
  parsedUnits: ParsedUnit[];
  extractError?: string;
  expanded: boolean;
}

function createDefaultSubject(name = "Software Engineering", offsetDays = 14): SubjectDraft {
  return {
    id: uid(),
    subjectName: name,
    examDate: addDays(todayISO(), offsetDays),
    hoursPerDay: 3,
    unitCount: 0,
    docFileName: "",
    isReadingDoc: false,
    syllabusText: "",
    parsedUnits: [],
    expanded: true,
  };
}

export function PersonalStudySetup({ onComplete }: { onComplete?: () => void }) {
  const currentUser = getCurrentUser();
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>("Analyzing syllabus...");
  const [editingUnitKey, setEditingUnitKey] = useState<string | null>(null);
  const [editUnitTitle, setEditUnitTitle] = useState("");
  const [editUnitTopics, setEditUnitTopics] = useState("");

  const [subjects, setSubjects] = useState<SubjectDraft[]>([
    createDefaultSubject("Software Engineering", 14),
  ]);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      setThemeState(custom.detail?.theme ?? getTheme());
    };
    window.addEventListener("exam-rescue:theme-changed", handleThemeChange);
    return () => window.removeEventListener("exam-rescue:theme-changed", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  // Mascot blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      const timer = setTimeout(() => setIsBlinking(false), 220);
      return () => clearTimeout(timer);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Entrance chime
  useEffect(() => {
    const timer = setTimeout(() => {
      playEntranceChime();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleAddSubject = () => {
    playPopChime(true);
    const names = [
      "Operating Systems",
      "Engineering Mathematics",
      "Database Management",
      "Computer Networks",
    ];
    const unusedName =
      names.find((n) => !subjects.some((s) => s.subjectName.toLowerCase() === n.toLowerCase())) ||
      "Advanced Subject";
    setSubjects((prev) => [...prev, createDefaultSubject(unusedName, 20)]);
  };

  const handleRemoveSubject = (id: string) => {
    if (subjects.length <= 1) return;
    playPopChime();
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSubject = (id: string, updates: Partial<SubjectDraft>) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };

        // If unit count changed and units exist, sync selected count
        if (
          updates.unitCount !== undefined &&
          updates.unitCount > 0 &&
          updated.parsedUnits.length > 0
        ) {
          updated.parsedUnits = updated.parsedUnits.map((u, i) => ({
            ...u,
            selectedForExam: i < (updates.unitCount || 4),
          }));
        }

        return updated;
      }),
    );
  };

  const handleDocUpload = async (id: string, file: File) => {
    updateSubject(id, {
      docFileName: file.name,
      isReadingDoc: true,
      extractError: undefined,
    });
    playPopChime(true);

    try {
      const text = await readSyllabusDoc(file);
      const currentSub = subjects.find((s) => s.id === id);
      const targetCount =
        currentSub?.unitCount && currentSub.unitCount > 0 ? currentSub.unitCount : undefined;

      const parsedUnits = extractSyllabusUnits(
        text,
        currentSub?.subjectName || "Subject",
        targetCount,
      );
      const selectedCount = parsedUnits.filter((u) => u.selectedForExam).length;

      updateSubject(id, {
        docFileName: file.name,
        isReadingDoc: false,
        syllabusText: text,
        parsedUnits,
        unitCount: selectedCount > 0 ? selectedCount : parsedUnits.length,
        extractError: undefined,
      });

      playCelebrationChime();
      toast.success(`Extracted ${parsedUnits.length} syllabus units from ${file.name}!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to read document.";
      updateSubject(id, {
        docFileName: "",
        isReadingDoc: false,
        parsedUnits: [],
        extractError: message,
      });
      toast.error("Could not extract syllabus from document", { description: message });
    }
  };

  const handleSaveSyllabus = (id: string) => {
    const sub = subjects.find((s) => s.id === id);
    if (!sub || !sub.syllabusText?.trim()) {
      updateSubject(id, {
        parsedUnits: [],
        extractError:
          "Please upload a PDF or Word document, or paste your syllabus text containing Units I–IV first.",
      });
      toast.error("Please upload or paste your syllabus first.");
      return;
    }

    try {
      const parsedUnits = extractSyllabusUnits(
        sub.syllabusText,
        sub.subjectName || "Subject",
        sub.unitCount && sub.unitCount > 0 ? sub.unitCount : undefined,
      );

      const selectedCount = parsedUnits.filter((u) => u.selectedForExam).length;

      updateSubject(id, {
        parsedUnits,
        unitCount: selectedCount > 0 ? selectedCount : parsedUnits.length,
        extractError: undefined,
      });

      playCelebrationChime();
      toast.success(`Successfully saved syllabus with ${parsedUnits.length} units!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to parse syllabus text.";
      updateSubject(id, { parsedUnits: [], extractError: message });
      toast.error("Parsing failed", { description: message });
    }
  };

  const toggleUnitSelection = (subjectId: string, unitNumber: number) => {
    playPopChime();
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const updatedUnits = s.parsedUnits.map((u) =>
          u.unitNumber === unitNumber ? { ...u, selectedForExam: !u.selectedForExam } : u,
        );
        const selectedCount = updatedUnits.filter((u) => u.selectedForExam).length;
        return {
          ...s,
          parsedUnits: updatedUnits,
          unitCount: selectedCount,
        };
      }),
    );
  };

  const handleUpdateUnitTitle = (
    subjectId: string,
    unitId: string,
    newTitle: string,
    newTopicsRaw?: string,
  ) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          parsedUnits: s.parsedUnits.map((u) => {
            if (u.id !== unitId) return u;
            let updatedTopics: SyllabusTopic[] = u.topics;

            if (newTopicsRaw !== undefined) {
              const items = newTopicsRaw
                .split(/[\r\n,;]+/)
                .map((item) => item.trim())
                .filter(Boolean);
              if (items.length > 0) {
                updatedTopics = items.map((item, idx) => ({
                  id: u.topics[idx]?.id || `unit-${u.unitNumber}-topic-${idx + 1}-${uid()}`,
                  name: item,
                  unit: u.unitLabel,
                  unitNumber: u.unitNumber,
                  subtopics: [item],
                  marks: u.topics[idx]?.marks || "",
                  objectives: u.topics[idx]?.objectives || "",
                  difficulty: u.topics[idx]?.difficulty || "Medium",
                  importance: u.topics[idx]?.importance || "High",
                  status: u.topics[idx]?.status || "Not Started",
                }));
              }
            } else if (updatedTopics.length === 0) {
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
              (n) =>
                !n.includes("was not detected") &&
                !n.includes("Missing in") &&
                !n.includes("No topics were identified"),
            );
            return {
              ...u,
              title: newTitle,
              topics: updatedTopics,
              flaggedNotes:
                remainingNotes && remainingNotes.length > 0 ? remainingNotes : undefined,
            };
          }),
        };
      }),
    );
  };

  const handleGenerateStudyPlan = () => {
    // 1. Validate subject names
    for (const sub of subjects) {
      if (!sub.subjectName.trim()) {
        toast.error("Please enter a subject name for all subjects.");
        return;
      }
    }

    // 2. Validate that syllabus was saved and parsed for all subjects
    for (const sub of subjects) {
      if (!sub.parsedUnits || sub.parsedUnits.length === 0) {
        toast.error(
          `Please upload a syllabus PDF or Word document (or paste your syllabus text) and click Save Syllabus for "${sub.subjectName}". We generate study plans exclusively from your actual syllabus units.`,
        );
        return;
      }

      const selected = sub.parsedUnits.filter((u) => u.selectedForExam);
      if (selected.length === 0) {
        toast.error(
          `Please select at least one unit appearing on the exam for "${sub.subjectName}".`,
        );
        return;
      }

      const emptyUnits = selected.filter((u) => u.topics.length === 0);
      if (emptyUnits.length > 0) {
        toast.error(
          `Please verify and enter topics for ${emptyUnits.map((u) => u.unitLabel).join(", ")} in "${sub.subjectName}" before generating your study plan.`,
        );
        return;
      }
    }

    setIsFinishing(true);
    playCelebrationChime(true);

    // Sequence of pleasant visual feedback steps
    setGenerationStage("Extracting core units and high-yield topics...");
    setTimeout(() => {
      setGenerationStage("Calculating exam proximity and priority weights...");
    }, 600);

    setTimeout(() => {
      setGenerationStage("Scheduling daily study sessions & revision checkpoints...");
    }, 1200);

    setTimeout(() => {
      // Build real exams from actual user syllabus data ONLY
      const createdExams: Exam[] = subjects.map((sub) => {
        const selectedUnits = sub.parsedUnits.filter((u) => u.selectedForExam);
        const examUnits = selectedUnits.length > 0 ? selectedUnits : sub.parsedUnits;
        const topics = buildTopicsFromSelectedUnits(examUnits);

        return {
          id: uid(),
          name: `${sub.subjectName} Exam`,
          subject: sub.subjectName,
          date: sub.examDate,
          hoursPerDay: sub.hoursPerDay,
          topics,
          includedUnits: examUnits.map((u) => u.unitNumber),
          totalUnitsInSyllabus: sub.parsedUnits.length,
          syllabusFileName: sub.docFileName || "Pasted Syllabus",
        };
      });

      // Save into AppState store & generate realistic plan
      actions.setUserStudyData(createdExams, currentUser?.name);

      // Update user profile onboarding status
      updateUserProfile({
        dailyHours: subjects[0]?.hoursPerDay || 3,
        onboardingCompleted: true,
      });

      setTimeout(() => {
        onComplete?.();
      }, 700);
    }, 1800);
  };

  // ── LOADING / GENERATION SCREEN ──
  if (isFinishing) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 text-white select-none">
        <MagicalBackground />

        <div className="relative z-10 flex flex-col items-center max-w-md text-center animate-card">
          {/* Animated 3D Mascot in Celebration Flying Stance */}
          <div className="relative h-44 w-44 drop-shadow-2xl animate-mascot-entrance mb-6">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full overflow-visible"
              aria-label="Archie Flying Celebration"
            >
              <defs>
                <radialGradient id="fly-body" cx="45%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="45%" stopColor="#9333ea" />
                  <stop offset="100%" stopColor="#4c1d95" />
                </radialGradient>
                <radialGradient id="fly-belly" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="60%" stopColor="#fdf2f8" />
                  <stop offset="100%" stopColor="#e9d5ff" />
                </radialGradient>
                <linearGradient id="fly-beak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>

              {/* Wings spread high in celebration */}
              <path
                d="M 50 110 C 20 80 15 50 45 45 C 60 55 65 85 62 115 Z"
                fill="#9333ea"
                stroke="#6b21a8"
                strokeWidth="1.5"
                className="animate-wing-wave origin-bottom-right"
              />
              <path
                d="M 150 110 C 180 80 185 50 155 45 C 140 55 135 85 138 115 Z"
                fill="#9333ea"
                stroke="#6b21a8"
                strokeWidth="1.5"
              />

              {/* Body */}
              <path
                d="M 66 52 C 68 38, 78 40, 84 56 C 94 54, 106 54, 116 56 C 122 40, 132 38, 134 52 C 148 70, 154 98, 150 130 C 146 162, 128 174, 100 174 C 72 174, 54 162, 50 130 C 46 98, 52 70, 66 52 Z"
                fill="url(#fly-body)"
              />

              {/* Belly */}
              <ellipse cx="100" cy="126" rx="36" ry="32" fill="url(#fly-belly)" />

              {/* Cheeks */}
              <circle cx="67" cy="104" r="8" fill="#f472b6" opacity="0.7" />
              <circle cx="133" cy="104" r="8" fill="#f472b6" opacity="0.7" />

              {/* Joyful Happy Curved Eyes */}
              <path
                d="M 72 90 Q 82 82 92 90"
                stroke="#3b0764"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 108 90 Q 118 82 128 90"
                stroke="#3b0764"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />

              {/* Beak */}
              <polygon points="94,97 106,97 100,109" fill="url(#fly-beak)" />

              {/* Mortarboard Cap */}
              <polygon points="100,28 148,40 100,52 52,40" fill="#3b0764" />
              <polygon points="100,28 148,40 100,33 52,40" fill="#581c87" />
              <circle cx="100" cy="40" r="3.5" fill="#fde047" />
              <path d="M 100 40 Q 130 45 138 60" stroke="#fbbf24" strokeWidth="2.5" fill="none" />
            </svg>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/20 px-4 py-1.5 text-xs font-semibold text-purple-200 mb-4 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
            <span>Building Your Custom Schedule</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white mb-2">
            Archie is crafting your mission plan!
          </h2>

          <p className="text-sm text-purple-200/80 mb-6 font-medium">{generationStage}</p>

          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 via-sky-400 to-pink-500 animate-pulse rounded-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── WELCOME MASCOT POP-OUT OVERLAY (First interaction) ──
  if (!welcomeDismissed) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 text-foreground select-none">
        <MagicalBackground />

        {/* Top Header with Brand & Theme Switcher */}
        <div className="relative z-10 w-full max-w-4xl flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-bold tracking-wide text-foreground">
              EXAM RESCUE
            </span>
          </div>

          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40 shadow-sm"
            title={`Switch to ${theme === "light" ? "Dark (Celestial)" : "Light (Pastel Lavender)"} Theme`}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5 text-purple-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-lg text-center animate-card my-auto">
          {/* Glowing Welcome Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-md mb-6 shadow-md shadow-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Welcome, {currentUser?.name || "Student"}!</span>
          </div>

          {/* Large 3D Animated Owl Mascot Figure */}
          <div className="relative h-52 w-52 sm:h-60 sm:w-60 drop-shadow-2xl animate-mascot-entrance mb-4">
            {/* Soft Ambient Mascot Glow */}
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />

            <svg
              viewBox="0 0 200 200"
              className="w-full h-full overflow-visible"
              aria-label="Large Welcoming Archie Mascot"
            >
              <defs>
                <radialGradient id="setup-body" cx="45%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="45%" stopColor="#9333ea" />
                  <stop offset="85%" stopColor="#6b21a8" />
                  <stop offset="100%" stopColor="#4c1d95" />
                </radialGradient>
                <radialGradient id="setup-belly" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="55%" stopColor="#fdf2f8" />
                  <stop offset="90%" stopColor="#f3e8ff" />
                  <stop offset="100%" stopColor="#e9d5ff" />
                </radialGradient>
                <linearGradient id="setup-beak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="60%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="setup-cap" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b0764" />
                  <stop offset="50%" stopColor="#581c87" />
                  <stop offset="100%" stopColor="#2e1065" />
                </linearGradient>
                <radialGradient id="setup-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Ground Shadow */}
              <ellipse
                cx="100"
                cy="186"
                rx="46"
                ry="10"
                fill="url(#setup-shadow)"
                className="animate-mascot-shadow"
              />

              {/* Feet */}
              <g>
                <ellipse cx="84" cy="172" rx="9" ry="5" fill="#f59e0b" />
                <ellipse cx="78" cy="172" rx="5" ry="4" fill="#fbbf24" />
                <ellipse cx="90" cy="172" rx="5" ry="4" fill="#fbbf24" />
                <ellipse cx="116" cy="172" rx="9" ry="5" fill="#f59e0b" />
                <ellipse cx="110" cy="172" rx="5" ry="4" fill="#fbbf24" />
                <ellipse cx="122" cy="172" rx="5" ry="4" fill="#fbbf24" />
              </g>

              {/* Left Wing (Resting) */}
              <path
                d="M 58 100 C 40 115 42 145 56 155 C 64 148 68 130 68 112 Z"
                fill="#7e22ce"
                stroke="#581c87"
                strokeWidth="1.5"
              />

              {/* Body */}
              <path
                d="M 66 52 C 68 38, 78 40, 84 56 C 94 54, 106 54, 116 56 C 122 40, 132 38, 134 52 C 148 70, 154 98, 150 130 C 146 162, 128 174, 100 174 C 72 174, 54 162, 50 130 C 46 98, 52 70, 66 52 Z"
                fill="url(#setup-body)"
              />

              {/* Belly */}
              <ellipse cx="100" cy="126" rx="36" ry="32" fill="url(#setup-belly)" />
              <path
                d="M 94 116 Q 100 120 106 116"
                stroke="#c084fc"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 86 128 Q 94 133 102 128"
                stroke="#c084fc"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 98 140 Q 106 145 114 140"
                stroke="#c084fc"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />

              {/* Cheeks */}
              <circle cx="67" cy="104" r="8.5" fill="#f472b6" opacity="0.65" />
              <circle cx="133" cy="104" r="8.5" fill="#f472b6" opacity="0.65" />

              {/* Eyes */}
              <ellipse cx="80" cy="90" rx="19" ry="20" fill="#ffffff" />
              <ellipse cx="120" cy="90" rx="19" ry="20" fill="#ffffff" />

              {isBlinking ? (
                <g>
                  <path
                    d="M 68 91 Q 80 95 92 91"
                    stroke="#3b0764"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 108 91 Q 120 95 132 91"
                    stroke="#3b0764"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
              ) : (
                <g>
                  <circle cx="82" cy="91" r="11" fill="#1e1035" />
                  <circle cx="118" cy="91" r="11" fill="#1e1035" />
                  <circle cx="82" cy="91" r="9" fill="#4c1d95" opacity="0.8" />
                  <circle cx="118" cy="91" r="9" fill="#4c1d95" opacity="0.8" />
                  <circle cx="79" cy="87" r="4.5" fill="#ffffff" />
                  <circle cx="115" cy="87" r="4.5" fill="#ffffff" />
                  <circle cx="85" cy="94" r="2" fill="#ffffff" />
                  <circle cx="121" cy="94" r="2" fill="#ffffff" />
                </g>
              )}

              {/* Rounded Glasses */}
              <g>
                <circle
                  cx="80"
                  cy="90"
                  r="19"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.9"
                />
                <circle
                  cx="120"
                  cy="90"
                  r="19"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.9"
                />
                <path
                  d="M 99 90 L 101 90"
                  stroke="#f43f5e"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>

              {/* Beak */}
              <polygon
                points="94,97 106,97 100,111"
                fill="url(#setup-beak)"
                stroke="#b45309"
                strokeWidth="0.8"
              />

              {/* Mortarboard Graduation Cap */}
              <g id="setup-mortarboard">
                <polygon
                  points="100,24 154,38 100,52 46,38"
                  fill="url(#setup-cap)"
                  stroke="#6b21a8"
                  strokeWidth="1"
                />
                <polygon points="100,24 154,38 100,30 46,38" fill="#581c87" />
                <path d="M 66 45 L 66 58 C 66 65, 134 65, 134 58 L 134 45 Z" fill="#2e1065" />
                <circle cx="100" cy="38" r="4" fill="#fbbf24" />
                <path d="M 100 38 Q 135 44 144 62" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
                <circle cx="144" cy="62" r="3" fill="#fbbf24" />
              </g>

              {/* Right Wing (Waving Joyfully) */}
              <g className="animate-wing-wave origin-[138px_110px]">
                <path
                  d="M 142 108 C 165 92 182 98 178 122 C 168 134 150 138 136 126 Z"
                  fill="#9333ea"
                  stroke="#581c87"
                  strokeWidth="1.5"
                />
                <path d="M 152 104 C 168 98 174 105 170 120 Z" fill="#c084fc" opacity="0.85" />
              </g>
            </svg>
          </div>

          {/* Welcoming Speech Bubble */}
          <div className="relative mb-6 rounded-2xl border border-primary/30 bg-card/95 p-5 shadow-2xl backdrop-blur-xl animate-speech-pop max-w-md">
            <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
              “Welcome to Exam Rescue! 🦉 Let&apos;s conquer your exams!”
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Tell me your subjects, exam dates, and upload your syllabus (PDF or Word document) or
              paste your syllabus text. I&apos;ll extract the units and build your realistic
              day-by-day study mission!
            </p>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => {
              playPopChime(true);
              setWelcomeDismissed(true);
            }}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white shadow-xl shadow-purple-500/30 transition-all transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Set Up My Exams</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── SIMPLE EXAM INFORMATION FORM (Requirement 2 & 3) ──
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 text-foreground select-none">
      <MagicalBackground />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {/* Header with mini Archie & Step indicator */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 text-primary shadow-md">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-foreground tracking-wide">
                Simple Exam Setup
              </h1>
              <p className="text-xs text-muted-foreground">
                Only what's needed to build your realistic study schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40 shadow-sm"
              title={`Switch to ${theme === "light" ? "Dark (Celestial)" : "Light (Pastel Lavender)"} Theme`}
            >
              {theme === "light" ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-purple-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5">
              {subjects.length} {subjects.length === 1 ? "Subject" : "Subjects"}
            </span>
          </div>
        </div>

        {/* Subjects List */}
        <div className="space-y-6">
          {subjects.map((sub, index) => {
            const daysLeft = Math.max(0, daysBetween(todayISO(), sub.examDate));
            const selectedUnitsCount = sub.parsedUnits.filter((u) => u.selectedForExam).length;

            return (
              <div
                key={sub.id}
                className="rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-5 sm:p-6 shadow-xl transition-all"
              >
                {/* Subject Header */}
                <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary border border-primary/30">
                      {index + 1}
                    </span>
                    <h2 className="text-base font-bold text-foreground">
                      {sub.subjectName || `Subject ${index + 1}`}
                    </h2>
                    <span className="rounded-full bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300">
                      📅 {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                    </span>
                  </div>

                  {subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub.id)}
                      className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-300 flex items-center gap-1 p-1 rounded transition"
                      title="Remove this subject"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  )}
                </div>

                {/* Form Fields: Subject Name, Exam Date, Hours, Unit Count */}
                <div className="grid gap-4 sm:grid-cols-2 mb-5">
                  {/* 1. Subject Name */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      1. Subject Name
                    </label>
                    <input
                      type="text"
                      required
                      value={sub.subjectName}
                      onChange={(e) => updateSubject(sub.id, { subjectName: e.target.value })}
                      placeholder="e.g. Software Engineering"
                      className="w-full rounded-xl border border-input bg-surface/70 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* 2. Exam Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        2. Exam Date
                      </label>
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                        {daysLeft} days until exam
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={sub.examDate}
                        min={todayISO()}
                        onChange={(e) => updateSubject(sub.id, { examDate: e.target.value })}
                        className="w-full rounded-xl border border-input bg-surface/70 px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  {/* 3. Daily Available Study Hours */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      3. Available Study Hours Per Day
                    </label>
                    <div className="flex items-center gap-2">
                      {[1.5, 2, 3, 4, 5].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            playPopChime();
                            updateSubject(sub.id, { hoursPerDay: h });
                          }}
                          className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg border transition-all",
                            sub.hoursPerDay === h
                              ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-surface/70 border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground",
                          )}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Number of units included in the exam */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      4. Number of Units In Exam
                    </label>
                    <div className="flex items-center gap-2">
                      {[3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            playPopChime();
                            updateSubject(sub.id, { unitCount: num });
                          }}
                          className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-lg border transition-all",
                            sub.unitCount === num
                              ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-surface/70 border-border/60 text-muted-foreground hover:bg-surface hover:text-foreground",
                          )}
                        >
                          {num} Units
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. Upload Syllabus (PDF or Word Doc) or Paste Syllabus Text */}
                <div className="mb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      5. Syllabus Units (Units I–IV)
                    </label>

                    <label className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] font-semibold text-primary cursor-pointer transition">
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.rtf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleDocUpload(sub.id, file);
                          e.target.value = "";
                        }}
                        className="sr-only"
                      />
                      {sub.isReadingDoc ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Reading document...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          <span>
                            {sub.docFileName
                              ? `Loaded: ${sub.docFileName}`
                              : "Upload Syllabus (PDF or Word)"}
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  <p className="text-[11px] text-muted-foreground mb-2">
                    Upload a{" "}
                    <span className="font-semibold text-foreground">
                      PDF (.pdf) or Word document (.docx / .doc / .txt)
                    </span>{" "}
                    above, or paste your syllabus text directly below. We extract only your syllabus
                    Units I–IV and topics with zero assumed content.
                  </p>

                  <textarea
                    rows={8}
                    value={sub.syllabusText}
                    onChange={(e) => updateSubject(sub.id, { syllabusText: e.target.value })}
                    placeholder={`UNIT I: Process Management\nCPU scheduling, Process synchronization, Threads, Concurrency control\n\nUNIT II: Memory Management\nPaging, Virtual memory, Segmentation, Page replacement algorithms\n\nUNIT III: Storage & File Systems\nFile system structure, Directory implementation, Disk scheduling algorithms\n\nUNIT IV: Distributed Systems & Security\nConsensus protocols, Fault tolerance, Authentication, Remote procedure calls`}
                    className="w-full rounded-xl border border-input bg-surface/70 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none transition shadow-sm font-mono leading-relaxed"
                  />

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      {sub.parsedUnits.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved {sub.parsedUnits.length} units ({selectedUnitsCount} selected for
                          exam)
                        </span>
                      ) : (
                        "Upload a PDF or Word document, or paste your syllabus text, then click Save Syllabus"
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveSyllabus(sub.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 transition active:scale-95"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Save Syllabus</span>
                    </button>
                  </div>

                  {/* Extraction Error Notice */}
                  {sub.extractError && (
                    <div className="mt-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">{sub.extractError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Units Included In Exam (Interactive selection & confirmation) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      6. Review, Edit &amp; Confirm Units ({selectedUnitsCount} of{" "}
                      {sub.parsedUnits.length} selected)
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Click to toggle units or click the pencil to edit title &amp; topics
                    </span>
                  </div>

                  {sub.parsedUnits.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-surface/40 p-6 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">
                        No syllabus units saved yet
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground max-w-sm mx-auto">
                        Upload a PDF or Word document above (or paste your syllabus text) and click{" "}
                        <span className="font-semibold text-foreground">Save Syllabus</span> to
                        verify your extracted units and topics.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sub.parsedUnits.map((unit) => {
                        const allTopicLabels = unit.topics.flatMap((t) =>
                          t.subtopics && t.subtopics.length > 1 ? t.subtopics : [t.name],
                        );
                        return (
                          <div
                            key={unit.id}
                            onClick={() => toggleUnitSelection(sub.id, unit.unitNumber)}
                            className={cn(
                              "cursor-pointer flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                              unit.selectedForExam
                                ? "bg-primary/10 border-primary/40 hover:border-primary/60"
                                : "bg-surface/50 border-border/40 text-muted-foreground hover:bg-surface hover:text-foreground",
                            )}
                          >
                            {/* Checkbox indicator */}
                            <div
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                                unit.selectedForExam
                                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                  : "border-input bg-card",
                              )}
                            >
                              {unit.selectedForExam && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                            </div>

                            {/* Unit info or Inline Edit Form */}
                            {editingUnitKey === `${sub.id}-${unit.id}` ? (
                              <div
                                className="flex-1 space-y-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-primary shrink-0">
                                    {unit.unitLabel} Title:
                                  </span>
                                  <input
                                    type="text"
                                    value={editUnitTitle}
                                    onChange={(e) => setEditUnitTitle(e.target.value)}
                                    placeholder="Unit title"
                                    className="flex-1 rounded border border-primary/50 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                                    Topics &amp; Subtopics (comma or newline separated):
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={editUnitTopics}
                                    onChange={(e) => setEditUnitTopics(e.target.value)}
                                    placeholder="Topic 1, Topic 2, Topic 3"
                                    className="w-full rounded border border-primary/50 bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingUnitKey(null)}
                                    className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateUnitTitle(
                                        sub.id,
                                        unit.id,
                                        editUnitTitle.trim() || unit.title,
                                        editUnitTopics,
                                      );
                                      setEditingUnitKey(null);
                                      playPopChime(true);
                                      toast.success("Unit title and topics updated");
                                    }}
                                    className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                                  >
                                    Save Unit
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-xs font-bold text-primary shrink-0">
                                      {unit.unitLabel}:
                                    </span>
                                    <span className="text-xs font-semibold text-foreground truncate">
                                      {unit.title}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingUnitKey(`${sub.id}-${unit.id}`);
                                      setEditUnitTitle(unit.title);
                                      setEditUnitTopics(allTopicLabels.join(", "));
                                    }}
                                    className="shrink-0 p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition"
                                    title="Edit unit title and topics"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>

                                {/* Flagged notice */}
                                {unit.flaggedNotes && unit.flaggedNotes.length > 0 && (
                                  <div className="mt-1.5 rounded bg-amber-500/10 border border-amber-500/25 p-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                                    <div className="font-semibold flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      <span>Verification needed:</span>
                                    </div>
                                    <p className="mt-0.5 text-muted-foreground">
                                      {unit.flaggedNotes[0]}
                                    </p>
                                  </div>
                                )}

                                {/* All detected topics & subtopics or Missing Notice */}
                                {unit.topics.length === 0 ? (
                                  <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    ⚠️ Missing topics — click edit pencil to verify &amp; add topics
                                  </p>
                                ) : (
                                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                                    {allTopicLabels.join(" • ")}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Status tag */}
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                unit.selectedForExam
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {unit.selectedForExam ? "On Exam" : "Excluded"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Another Subject Button */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleAddSubject}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-card hover:bg-surface border border-border text-foreground hover:text-primary transition shadow-sm"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span>+ Add Another Subject</span>
          </button>
        </div>

        {/* Footer Launch Study Plan Action */}
        <div className="mt-8 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="text-xs font-bold text-foreground">
              Ready to generate your study plan?
            </div>
            <div className="text-[11px] text-muted-foreground">
              Archie will prioritize core units into realistic daily study sessions.
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateStudyPlan}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white shadow-xl shadow-purple-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Generate Study Plan</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
