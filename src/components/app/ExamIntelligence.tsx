import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Plus,
  Settings2,
  Trash2,
  Upload,
  ExternalLink,
  ListChecks,
  Siren,
  Sparkles,
  Search,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  DropZone,
  Field,
  PageHeader,
  Panel,
  PriorityBadge,
  SectionHeader,
  inputCls,
} from "./ui";
import { actions, useAppState } from "@/lib/store";
import { addDays, fmtDay, fmtMin, todayISO, uid } from "@/lib/engine";
import {
  emptyIntelligence,
  intelligenceRanking,
  mergeSyllabus,
  normalize,
  paperYears,
  parseSyllabus,
  preparationStrategy,
  publicSource,
  type Intelligence,
  type Paper,
  type SyllabusTopic,
} from "@/lib/intelligence";
import { readPdf } from "@/lib/pdf";
import { searchPYQServerFn, type SearchPYQItem } from "@/lib/pyq-search";
import type { Exam, Difficulty, Importance, Status } from "@/lib/types";

function detectSubject(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 8).join(" ");
  const patterns = [
    /(?:b\.?tech|b\.?e\.?)\s*(?:in\s+)?([a-z][a-z\s&]+?)(?:\s*(?:semester|sem|course|subject))/i,
    /(?:subject|course|paper)\s*[:-]\s*([a-z][a-z\s&]+)/i,
    /(?:m\.?tech|m\.?e\.?)\s*(?:in\s+)?([a-z][a-z\s&]+?)(?:\s*(?:semester|sem|course|subject))/i,
  ];
  for (const p of patterns) {
    const m = firstLines.match(p);
    if (m?.[1] && m[1].trim().length > 2 && m[1].trim().length < 60)
      return m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "";
}

export function ExamIntelligence({ research = false }: { research?: boolean }) {
  const s = useAppState();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Intelligence>(() => s.intelligence ?? emptyIntelligence());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<string[]>(() =>
    (s.intelligence?.topics ?? []).map((t) => t.name),
  );
  const [date, setDate] = useState(addDays(todayISO(), 7));
  const [hours, setHours] = useState(2);
  const [newId] = useState(() => uid());
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [paper, setPaper] = useState<Paper>({
    id: "",
    title: "",
    url: "",
    text: "",
    year: "",
    review: "pending",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchPYQItem[]>([]);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [customQuery, setCustomQuery] = useState<string | null>(null);

  const assembledResearchQuery = [
    draft.university,
    draft.course,
    draft.subject,
    draft.semester && `semester ${draft.semester}`,
    draft.examType,
    "previous year question paper",
    ...draft.topics.slice(0, 3).map((t) => t.name),
  ]
    .filter(Boolean)
    .join(" ");

  const effectiveQuery = customQuery ?? assembledResearchQuery;

  const handleLiveSearch = async () => {
    const queryToSearch = effectiveQuery.trim();
    if (!queryToSearch) {
      toast.error("Add your university or subject above to build a research query.");
      return;
    }
    setIsSearching(true);
    setSearchError("");
    setHasSearched(true);
    try {
      const res = await searchPYQServerFn({
        data: {
          query: queryToSearch,
          university: draft.university,
          course: draft.course,
          subject: draft.subject,
          semester: draft.semester,
          examType: draft.examType,
          topics: draft.topics.map((t) => t.name),
        },
      });

      if (!res.ok) {
        setSearchError(res.error || "Search failed.");
        setSearchResults([]);
      } else {
        setSearchResults(res.results);
        if (res.results.length === 0) {
          toast.info("No matching papers found for this exact query.");
        } else {
          toast.success(`Found ${res.results.length} question paper result(s).`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to execute search";
      setSearchError(msg);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (item: SearchPYQItem) => {
    const yearMatch = (item.title + " " + item.url + " " + item.snippet).match(
      /\b(20[0-2][0-9]|19[9][0-9])\b/,
    );
    setPaper((prev) => ({
      ...prev,
      title: item.title,
      url: item.url,
      text: item.snippet ? `[Extracted snippet from ${item.url}]\n\n${item.snippet}` : prev.text,
      year: yearMatch ? yearMatch[0]! : prev.year,
    }));
    toast.info("Paper form pre-filled below.", {
      description:
        "Review details, attach full PDF if available, then click 'Add paper for review'.",
    });
  };

  const baseExam = s.exams.find((e) => e.id === draft.examId);
  const exam: Exam = baseExam ?? {
    id: newId,
    name: `${draft.subject || "Syllabus"} · ${draft.examType}`,
    subject: draft.subject || "Syllabus",
    date,
    hoursPerDay: hours,
    topics: [],
  };
  const rankings = intelligenceRanking(draft, s, exam, todayISO());
  const selection = rankings
    .filter((r) => chosen.some((n) => normalize(n) === normalize(r.topic.name)))
    .map((r) => r.topic.id);
  const strategy = strategyOpen ? preparationStrategy(draft, s, exam, selection) : null;
  const analyzed = draft.papers.filter((p) => p.review === "verified" && p.text.trim());
  const years = [...new Set(analyzed.map((p) => p.year).filter(Boolean))].sort();
  const update = (next: Intelligence) => {
    setDraft(next);
    setStrategyOpen(false);
  };
  const save = () => {
    actions.saveIntelligence(draft);
    toast.success("Syllabus and evidence saved on this device.");
  };
  const extract = (value: string) => {
    const topics = parseSyllabus(value);
    const detected = detectSubject(value);
    const next = { ...draft, topics, subject: draft.subject || detected };
    update(next);
    setChosen(topics.map((t) => t.name));
    setError("");
    if (detected)
      toast.success(`Subject detected: ${detected}`, { description: "Review and edit if needed." });
  };
  const upload = async (file: File | undefined, isPaper = false) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const value = await readPdf(file);
      if (isPaper) setPaper((p) => ({ ...p, title: p.title || file.name, text: value }));
      else {
        setText(value);
        extract(value);
      }
      toast.success("PDF text extracted. Review it before saving.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot read this PDF. Paste text instead.");
    } finally {
      setBusy(false);
    }
  };
  const editTopic = (id: string, change: Partial<SyllabusTopic>) =>
    update({ ...draft, topics: draft.topics.map((t) => (t.id === id ? { ...t, ...change } : t)) });
  const addPaper = () => {
    const url = publicSource(paper.url);
    if (!url || !paper.title.trim() || !paper.text.trim()) {
      setError("Add a title, public HTTPS source link, and readable paper text or PDF.");
      return;
    }
    if (paper.year && !paperYears(paper.text).includes(paper.year)) {
      setError("The selected year does not appear in the paper text. Leave it unverified.");
      return;
    }
    const next = { ...draft, papers: [...draft.papers, { ...paper, url, id: uid() }] };
    update(next);
    actions.saveIntelligence(next);
    setPaper({ id: "", title: "", url: "", text: "", year: "", review: "pending" });
    setError("");
    toast.success("Paper added for review.");
  };
  const send = async (rescue = false) => {
    if (!draft.subject.trim() || !selection.length) {
      setError("Enter a subject and select at least one topic.");
      return;
    }
    if (
      exam.date <= todayISO() ||
      !Number.isFinite(exam.hoursPerDay) ||
      exam.hoursPerDay <= 0 ||
      exam.hoursPerDay > 24
    ) {
      setError("Choose a future exam date and between 0 and 24 study hours per day.");
      return;
    }
    const topics = rankings.filter((r) => selection.includes(r.topic.id)).map((r) => r.topic);
    const merged = mergeSyllabus(exam, topics);
    if (rescue) actions.saveExam(merged);
    else actions.sendStrategy(merged, preparationStrategy(draft, s, exam, selection).days);
    actions.saveIntelligence({ ...draft, examId: merged.id });
    toast.success(
      rescue
        ? "Selected topics sent to Rescue Mode."
        : "Strategy added; existing planner tasks preserved.",
    );
    await navigate(rescue ? { to: "/rescue", search: { exam: merged.id } } : { to: "/planner" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={research ? "PYQ Research" : "Syllabus Analyzer"}
        sub={
          research
            ? "Review real question papers and topic evidence."
            : "Upload your syllabus, review extracted topics, and build an evidence-based plan."
        }
        action={
          <Button
            variant="ghost"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete the saved syllabus and all its evidence from this device? Planner topics will remain.",
                )
              )
                return;
              actions.deleteIntelligence();
              setDraft(emptyIntelligence());
              setText("");
              setChosen([]);
              setStrategyOpen(false);
              toast.success("Syllabus and evidence deleted.");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete syllabus
          </Button>
        }
      />
      <nav className="flex flex-wrap gap-3 border-b pb-4">
        <Link to="/syllabus">
          <Button variant={research ? "outline" : "primary"}>
            <BookOpenCheck className="h-4 w-4" />
            Syllabus Analyzer
          </Button>
        </Link>
        <Link to="/pyq">
          <Button variant={research ? "primary" : "outline"}>
            <FileSearch className="h-4 w-4" />
            PYQ Research
          </Button>
        </Link>
      </nav>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Upload / paste section — first thing students see */}
      {!research && (
        <section className="space-y-4">
          <Panel>
            <SectionHeader
              icon={<Upload className="h-5 w-5" />}
              title="Upload your study material"
              sub="Drop a syllabus PDF or paste text directly. We'll extract units and topics for you to review."
            />
            <DropZone
              icon={<Upload className="h-5 w-5" />}
              title="Choose a syllabus PDF"
              hint="PDF only, up to 20 MB. Private on this device — originals are never uploaded."
              accept="application/pdf"
              busy={busy}
              onFile={(f) => void upload(f)}
            />
          </Panel>

          <Panel>
            <SectionHeader
              icon={<FileSearch className="h-5 w-5" />}
              title="Or paste syllabus text"
              sub="Skip the upload — paste text and we'll extract topics instantly."
              tone="muted"
            />
            <textarea
              className={`${inputCls} h-40 py-3`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Unit 1: Foundations&#10;Arrays: traversal, insertion, deletion&#10;Unit 2: Trees&#10;Binary search trees"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  try {
                    extract(text);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Cannot extract topics.");
                  }
                }}
              >
                {busy ? "Reading PDF…" : "Extract topics"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  update({
                    ...draft,
                    topics: [
                      ...draft.topics,
                      {
                        id: uid(),
                        name: "",
                        unit: "",
                        subtopics: [],
                        marks: "",
                        objectives: "",
                        difficulty: "Medium",
                        importance: "Medium",
                        status: "Not Started",
                      },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add topic manually
              </Button>
            </div>
          </Panel>
        </section>
      )}

      {/* Optional academic details — collapsed by default */}
      {!research && (
        <section className="border-t pt-4">
          <button
            onClick={() => setOptionalOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              Optional academic details
            </div>
            {optionalOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {optionalOpen && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(["university", "course", "semester", "subject"] as const).map((key) => (
                <Field key={key} label={key[0]?.toUpperCase() + key.slice(1)}>
                  <input
                    className={inputCls}
                    value={draft[key]}
                    onChange={(e) => update({ ...draft, [key]: e.target.value })}
                  />
                </Field>
              ))}
              <Field label="Exam type">
                <select
                  className={inputCls}
                  value={draft.examType}
                  onChange={(e) => update({ ...draft, examType: e.target.value })}
                >
                  {["End semester", "Mid semester", "Internal assessment", "Other"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target exam">
                <select
                  className={inputCls}
                  value={draft.examId}
                  onChange={(e) => {
                    const target = s.exams.find((x) => x.id === e.target.value);
                    update({
                      ...draft,
                      examId: e.target.value,
                      subject: target?.subject ?? draft.subject,
                    });
                  }}
                >
                  <option value="">Create a new exam</option>
                  {s.exams.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </section>
      )}

      {/* Review extracted topics */}
      {!research && draft.topics.length > 0 && (
        <section className="space-y-4 border-t pt-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Review extracted topics{" "}
              <span className="text-muted-foreground">({draft.topics.length})</span>
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            We extracted these from your text. Edit names, units, and difficulty before saving.
            Wrong extraction? Edit or delete any topic.
          </p>
          {draft.topics.map((t, i) => (
            <article key={t.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">TOPIC {i + 1}</span>
                <Button
                  title="Remove topic"
                  aria-label={`Remove topic ${i + 1}`}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({ ...draft, topics: draft.topics.filter((x) => x.id !== t.id) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Topic name">
                  <input
                    className={inputCls}
                    value={t.name}
                    onChange={(e) => editTopic(t.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Syllabus unit">
                  <input
                    className={inputCls}
                    value={t.unit}
                    onChange={(e) => editTopic(t.id, { unit: e.target.value })}
                  />
                </Field>
                <Field label="Subtopics (comma separated)">
                  <input
                    className={inputCls}
                    value={t.subtopics.join(", ")}
                    onChange={(e) =>
                      editTopic(t.id, { subtopics: e.target.value.split(",").map((x) => x.trim()) })
                    }
                  />
                </Field>
                <Field label="Stated marks distribution">
                  <input
                    className={inputCls}
                    value={t.marks}
                    onChange={(e) => editTopic(t.id, { marks: e.target.value })}
                  />
                </Field>
                <Field label="Learning objectives">
                  <input
                    className={inputCls}
                    value={t.objectives}
                    onChange={(e) => editTopic(t.id, { objectives: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Importance">
                    <select
                      className={inputCls}
                      value={t.importance}
                      onChange={(e) =>
                        editTopic(t.id, { importance: e.target.value as Importance })
                      }
                    >
                      {["Low", "Medium", "High"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Difficulty">
                    <select
                      className={inputCls}
                      value={t.difficulty}
                      onChange={(e) =>
                        editTopic(t.id, { difficulty: e.target.value as Difficulty })
                      }
                    >
                      {["Easy", "Medium", "Hard"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </article>
          ))}
          <Button
            variant="signal"
            disabled={!draft.topics.length}
            onClick={() => {
              if (
                draft.topics.some((t) => !t.name.trim()) ||
                new Set(draft.topics.map((t) => normalize(t.name))).size !== draft.topics.length
              ) {
                setError("Topic names must be nonempty and unique.");
                return;
              }
              setChosen(draft.topics.map((t) => t.name));
              save();
            }}
          >
            Save reviewed syllabus
          </Button>
        </section>
      )}

      {/* PYQ Research section */}
      {research && (
        <section className="space-y-4 border-t pt-5">
          <SectionHeader
            icon={<FileSearch className="h-5 w-5" />}
            title="Public question paper resources"
            sub="Review real question papers and topic evidence — no fabricated results."
            tone="warning"
          />
          {/* Live PYQ Search Interface */}
          <div className="space-y-3">
            <Field label="Research query (auto-assembled from syllabus, or edit directly)">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="e.g. University, course, subject previous year question paper"
                  value={effectiveQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
                {customQuery !== null && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCustomQuery(null)}
                    title="Reset query to auto-assembled syllabus query"
                    className="text-xs text-muted-foreground"
                  >
                    Reset
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  disabled={isSearching || !effectiveQuery.trim()}
                  onClick={handleLiveSearch}
                  className="shrink-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching web…
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search live PYQs
                    </>
                  )}
                </Button>
              </div>
            </Field>

            {/* Loading State */}
            {isSearching && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm animate-pulse">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                <div>
                  <p className="font-semibold text-foreground">
                    Querying live web via Tavily Search…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Searching for public university examination question papers and PDF documents
                    matching your syllabus.
                  </p>
                </div>
              </div>
            )}

            {/* Error / Retry State */}
            {!isSearching && searchError && (
              <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Search failed</p>
                    <p className="mt-0.5 text-xs text-foreground/80">{searchError}</p>
                    {searchError.includes("TAVILY_API_KEY") && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure{" "}
                        <span className="font-mono font-semibold text-foreground">
                          TAVILY_API_KEY
                        </span>{" "}
                        in your environment or Vercel project settings.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLiveSearch}
                  disabled={isSearching || !assembledResearchQuery.trim()}
                  className="shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry search
                </Button>
              </div>
            )}

            {/* Honest No-Results State */}
            {!isSearching && !searchError && hasSearched && searchResults.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                <FileSearch className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No question paper resources found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No public previous year question papers matched this specific query. Try checking
                  your university or subject spelling above, or upload a question paper PDF below.
                </p>
              </div>
            )}

            {/* Results List */}
            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Live Question Paper Results ({searchResults.length})
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLiveSearch}
                    disabled={isSearching}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {searchResults.map((item, idx) => (
                    <article
                      key={`${item.url}-${idx}`}
                      className="animate-list space-y-2 rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center gap-1.5 break-words font-semibold text-primary transition hover:underline"
                        >
                          <span className="line-clamp-1">{item.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.isPdf && <Badge tone="lime">PDF Resource</Badge>}
                          {item.isAcademicDomain && (
                            <Badge tone="violet">Academic / University Domain</Badge>
                          )}
                          {item.domain && <Badge tone="muted">{item.domain}</Badge>}
                        </div>
                      </div>

                      {item.snippet && (
                        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                          {item.snippet}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                        <span className="max-w-[240px] truncate sm:max-w-md">{item.url}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectSearchResult(item)}
                          className="text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Pre-fill paper form
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Panel>
            <SectionHeader
              icon={<Plus className="h-5 w-5" />}
              title="Add a real paper for review"
              sub="Use the original source, preferably a university examination portal. User verification is not a claim of official publication."
              tone="muted"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Paper title">
                <input
                  className={inputCls}
                  value={paper.title}
                  onChange={(e) => setPaper({ ...paper, title: e.target.value })}
                />
              </Field>
              <Field label="Original source link">
                <input
                  type="url"
                  className={inputCls}
                  value={paper.url}
                  onChange={(e) => setPaper({ ...paper, url: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4">
              <DropZone
                icon={<Upload className="h-5 w-5" />}
                title="Upload question paper PDF"
                hint="PDF only. Originals stay on this device."
                accept="application/pdf"
                busy={busy}
                onFile={(f) => void upload(f, true)}
              />
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Retrieved paper text">
                <textarea
                  className={`${inputCls} h-32 py-3`}
                  value={paper.text}
                  onChange={(e) => setPaper({ ...paper, text: e.target.value, year: "" })}
                />
              </Field>
              <Field label="Year stated in paper">
                <select
                  className={inputCls}
                  value={paper.year}
                  onChange={(e) => setPaper({ ...paper, year: e.target.value })}
                >
                  <option value="">Unverified year</option>
                  {paperYears(paper.text).map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <Button disabled={busy} onClick={addPaper}>
                <Plus className="h-4 w-4" />
                Add paper for review
              </Button>
            </div>
          </Panel>
          {!draft.papers.length && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No papers retrieved or analyzed yet. Add one above to start building evidence.
            </div>
          )}
          {draft.papers.map((p) => (
            <article
              key={p.id}
              className="animate-list space-y-3 rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 break-words font-semibold text-primary transition hover:underline"
                >
                  {p.title}
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
                <Badge tone={p.review === "verified" ? "lime" : "muted"}>
                  {p.review === "verified" ? "Verified by you" : p.review}
                </Badge>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                {new URL(p.url).hostname} · {p.year || "Year unverified"} ·{" "}
                {p.text.trim() ? "Text available" : "No readable text"}
              </p>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Paper text
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-xs">
                  {p.text}
                </pre>
              </details>
              <p className="text-xs text-muted-foreground">
                Matched topics:{" "}
                <span className="font-medium text-foreground">
                  {draft.topics
                    .filter((t) => ` ${normalize(p.text)} `.includes(` ${normalize(t.name)} `))
                    .map((t) => t.name)
                    .join(", ") || "No exact matches"}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(["verified", "irrelevant", "pending"] as const).map((review) => (
                  <Button
                    size="sm"
                    variant={p.review === review ? "primary" : "outline"}
                    key={review}
                    onClick={() => {
                      const next = {
                        ...draft,
                        papers: draft.papers.map((x) => (x.id === p.id ? { ...x, review } : x)),
                      };
                      update(next);
                      actions.saveIntelligence(next);
                    }}
                  >
                    {review === "verified"
                      ? "Mark verified"
                      : review === "irrelevant"
                        ? "Mark irrelevant"
                        : "Reset review"}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => {
                    const next = { ...draft, papers: draft.papers.filter((x) => x.id !== p.id) };
                    update(next);
                    actions.saveIntelligence(next);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Topic intelligence and strategy */}
      {rankings.length > 0 && (
        <section className="space-y-4 border-t pt-6">
          <SectionHeader
            icon={<Sparkles className="h-5 w-5" />}
            title="Important topic intelligence"
            sub={`Year range: ${years.length ? `${years[0]}–${years.at(-1)}` : "Not verified"}. Exact wording matches only, not semantic analysis. Priorities with fewer than three reviewed papers are provisional.`}
            action={<Badge tone="lime">{analyzed.length} papers analyzed</Badge>}
          />
          {rankings.map((r) => (
            <article
              key={r.topic.id}
              className="animate-list rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckToggle
                    checked={chosen.some((n) => normalize(n) === normalize(r.topic.name))}
                    onChange={(checked) =>
                      setChosen(
                        checked
                          ? [...chosen, r.topic.name]
                          : chosen.filter((n) => normalize(n) !== normalize(r.topic.name)),
                      )
                    }
                    ariaLabel={`Select ${r.topic.name}`}
                  />
                  <span className="break-words font-semibold text-foreground">
                    {r.topic.name}
                    {r.topic.unit && (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {r.topic.unit}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2">
                  <PriorityBadge level={r.level} />
                  {r.provisional && <Badge tone="amber">Provisional</Badge>}
                </div>
              </div>
              <ul className="mt-3 space-y-1 pl-9 text-xs text-muted-foreground">
                {r.reasons.map((reason) => (
                  <li key={reason} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
              {r.evidence.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3 pl-9">
                  {r.evidence.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary transition hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {p.title} · {p.year || "year unverified"}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 pl-9">
                <Field label="Preparation status">
                  <select
                    className={`${inputCls} mt-1 max-w-48`}
                    value={r.topic.status}
                    onChange={(e) => {
                      const status = e.target.value as Status;
                      if (baseExam?.topics.some((t) => t.id === r.topic.id))
                        actions.setTopicStatus(r.topic.id, status);
                      else editTopic(r.topic.id, { status });
                    }}
                  >
                    {["Not Started", "Learning", "Revised"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </article>
          ))}
          {!baseExam && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Exam date">
                <input
                  type="date"
                  className={inputCls}
                  value={date}
                  min={addDays(todayISO(), 1)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Available study hours per day">
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  className={inputCls}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                />
              </Field>
            </div>
          )}
          {baseExam && (
            <p className="text-sm text-muted-foreground">
              {baseExam.name} · {fmtDay(baseExam.date)} · {baseExam.hoursPerDay}h/day
            </p>
          )}
          <Button
            variant="signal"
            disabled={!selection.length}
            className="h-auto min-h-10 py-2 text-left"
            onClick={() => {
              if (!draft.subject.trim() || exam.date <= todayISO() || hours <= 0 || hours > 24) {
                setError("Enter a subject, future exam date, and valid study hours.");
                return;
              }
              setStrategyOpen(true);
            }}
          >
            Generate My Preparation Strategy
          </Button>
          {strategy && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Your day-by-day strategy</h3>
              <p className="text-xs text-muted-foreground">
                Existing planner commitments and breaks count toward the limit. Planning ends before
                exam day; today stops at 11pm. Preview covers at most 60 days.
              </p>
              {strategy.incomplete.length > 0 && (
                <p role="status" className="text-sm text-warning">
                  Not everything fits. Partly covered or deferred: {strategy.incomplete.join(", ")}.
                  Highest-value topics come first.
                </p>
              )}
              {!strategy.days.length && (
                <p className="text-sm text-warning">
                  No free study capacity remains alongside your existing planner.
                </p>
              )}
              {strategy.days.map((d) => (
                <article key={d.date} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex justify-between gap-2">
                    <h4 className="font-semibold text-foreground">{fmtDay(d.date)}</h4>
                    <span className="font-mono text-xs text-signal">
                      {fmtMin(d.used)} / {fmtMin(d.budget)} free
                    </span>
                  </div>
                  <ol className="mt-3 space-y-2">
                    {d.sessions.map((session, i) => (
                      <li key={i} className="flex justify-between gap-3 text-sm">
                        <span className="break-words text-foreground">{session.title}</span>
                        <span className="shrink-0 text-muted-foreground">{session.minutes}m</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
              <div className="flex flex-wrap gap-3">
                <Button disabled={!strategy.days.length} onClick={() => void send()}>
                  <ListChecks className="h-4 w-4" />
                  Send to Study Planner
                </Button>
                <Button variant="outline" onClick={() => void send(true)}>
                  <Siren className="h-4 w-4" />
                  Send to Rescue Mode
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
