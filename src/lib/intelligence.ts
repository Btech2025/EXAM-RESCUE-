import { addDays, estimateMinutes, toISO, topicPriority, uid } from "./engine";
import type { AppState, Exam, Plan, PriorityLevel, Topic } from "./types";

export interface SyllabusTopic extends Topic {
  unit: string;
  subtopics: string[];
  marks: string;
  objectives: string;
}

export interface Paper {
  id: string;
  title: string;
  url: string;
  text: string;
  year: string;
  review: "pending" | "verified" | "irrelevant";
}

export interface Intelligence {
  university: string;
  course: string;
  semester: string;
  subject: string;
  examType: string;
  examId: string;
  topics: SyllabusTopic[];
  papers: Paper[];
}

export interface ParsedUnit {
  id: string;
  unitNumber: number;
  unitLabel: string;
  title: string;
  topics: SyllabusTopic[];
  selectedForExam: boolean;
  courseOutcomes?: string[];
  flaggedNotes?: string[];
}

export const emptyIntelligence = (): Intelligence => ({
  university: "",
  course: "",
  semester: "",
  subject: "",
  examType: "End semester",
  examId: "",
  topics: [],
  papers: [],
});

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function publicSource(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  "01": 1,
  "02": 2,
  "03": 3,
  "04": 4,
  "05": 5,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "1v": 4,
  lv: 4,
  "|v": 4,
  "!v": 4,
  "11": 2,
  ll: 2,
  "||": 2,
  "111": 3,
  lll: 3,
  "|||": 3,
};

export function toRomanUnit(n: number): string {
  switch (n) {
    case 1:
      return "Unit I";
    case 2:
      return "Unit II";
    case 3:
      return "Unit III";
    case 4:
      return "Unit IV";
    case 5:
      return "Unit V";
    default:
      return `Unit ${n}`;
  }
}

function normalizeHeadingChars(val: string): string {
  return val
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\uFF1A]/g, ":")
    .replace(/\u2160|\u2170/g, "I")
    .replace(/\u2161|\u2171/g, "II")
    .replace(/\u2162|\u2172/g, "III")
    .replace(/\u2163|\u2173/g, "IV")
    .replace(/\u2164|\u2174/g, "V");
}

function parseUnitNumber(val: string): number {
  const clean = normalizeHeadingChars(val).trim().toLowerCase();
  if (ROMAN_NUMERALS[clean]) return ROMAN_NUMERALS[clean];
  const num = parseInt(clean, 10);
  return isNaN(num) ? 1 : num;
}

// Matches explicit unit headings such as:
// "Unit 1", "Unit I", "UNIT-1", "Unit: 1", "Unit :- 1", "Unit : - 1", "Unit No. 1", "Unit No 1", "UNIT-II", "Module 1", etc.
const UNIT_HEADING_REGEX =
  /^(?:\d+[.)]\s*)?(?:\[\s*)?(?:unit|un1t|u\s*n\s*i\s*t|module|modu1e)\b(?:\s*[:–.—-]*\s*(?:no\b\.?|num(?:ber)?\b\.?|#))?[\s:–.—-]*(0?[1-9]\d*|[ivx]+|one|two|three|four|five|[1l|!]v|[1l|]{2,3})\b(?:\s*\])?(?:\s*(?:[:–.—-]\s*)+(.*)|\s+(.+))?$/i;

const POST_SYLLABUS_BOUNDARY_REGEX =
  /^(?:text\s*books?|reference\s*books?|references?|suggested\s*readings?|recommended\s*readings?|question\s*paper\s*pattern|examination\s*scheme|scheme\s*of\s*examination|internal\s*assessment|evaluation\s*scheme|practical\s*work|laboratory|experiments?|list\s+of\s+experiments?|web\s*references?|online\s*resources?|e-?resources?)\b/i;

function isOutcomePreambleLine(l: string): boolean {
  const stripped = normalizeHeadingChars(l)
    .replace(/^[•*–o>·-]\s*/, "")
    .trim();
  return /^(?:at\s+the\s+end\s+of\s+(?:the|this)\s+course|after\s+(?:completing|completion\s+of)\s+(?:the|this)\s+course|upon\s+(?:successful\s+)?completion\s+of|on\s+completion\s+of\s+(?:the|this)\s+course|(?:the\s+)?(?:students?|learners?|candidates?)\s+(?:will|shall|should)\s+be\s+able\s+to|to\s+enable\s+(?:the\s+)?students?\s+to)\b/i.test(
    stripped,
  );
}

function isMetadataSectionHeading(l: string): boolean {
  const stripped = normalizeHeadingChars(l)
    .replace(/^[•*–o>·\d.)\s]+/, "")
    .trim();
  return (
    /^(?:(?:course|learning|program|programme|educational|subject|student)\s+)?(?:outcomes?|objectives?)(?:\s*\([^)]*\))?\s*[:–.—-]*$/i.test(
      stripped,
    ) ||
    /^(?:course\s+outcomes?|course\s+objectives?|learning\s+outcomes?|learning\s+objectives?|program(?:me)?\s+outcomes?|program(?:me)?\s+specific\s+outcomes?|program(?:me)?\s+educational\s+objectives?)\b/i.test(
      stripped,
    ) ||
    /^(?:outcomes?|objectives?|cos?|pos?|psos?|peos?|clos?)(?:\s*\([^)]*\))?(?:\s*[-–/&]\s*(?:cos?|pos?|psos?))?(?:\s+mapping|\s+matrix|\s+attainment)?\s*(?:[:–.—-]+.*)?$/i.test(
      stripped,
    ) ||
    /^(?:co\s*[-–/]\s*po|mapping\s+of\s+(?:course\s+)?outcomes?|articulation\s+matrix|course\s+description|course\s+details?|course\s+overview|course\s+information|course\s+preamble|preamble|syllabus\s+details?|university\s+name|teaching\s+scheme|examination\s+scheme|evaluation\s+scheme|assessment\s+pattern)\b/i.test(
      stripped,
    )
  );
}

function isOutcomeOrObjectiveLine(l: string): boolean {
  const stripped = normalizeHeadingChars(l)
    .replace(/^(?:[•*–o>·-]|\(\d+\)|\([a-z]\)|\d+[.)])\s*/i, "")
    .trim();
  return (
    isMetadataSectionHeading(stripped) ||
    isOutcomePreambleLine(stripped) ||
    /^(?:(?:course\s+|learning\s+|program(?:me)?\s+|educational\s+)?(?:outcomes?|objectives?)|cos?|pos?|psos?)(?:\s*[-_.:–—#]?\s*(?:[1-9]\d*|[ivx]+))?\s*[:–.-]/i.test(
      stripped,
    ) ||
    /^(?:co|po|pso|peo|clo)(?:\s*[-_.:–—]?\s*0?[1-9]\d*|\s+[ivx]+|[-_.:–—]\s*[ivx]+)\b/i.test(
      stripped,
    )
  );
}

function isBoilerplateLine(l: string): boolean {
  const stripped = normalizeHeadingChars(l)
    .replace(/^[•*–o>·-]\s*/, "")
    .trim();
  return (
    /^(?:page\s+\d+|university\s*name|course\s*(?:code|no|number|id|title|name|type|category|credits?|details?|objectives?|outcomes?)|subject\s*(?:code|no|number|title|name)|paper\s*(?:code|no|title|name)|program(?:me)?\s*outcomes?|semester|academic\s+year|session|credits?|l\s*[-:/]\s*t\s*[-:/]\s*p|lecture\s*hours?|total\s*hours?|contact\s*hours?|hours?\s*[:/]|max(?:imum)?\s*marks?|min(?:imum)?\s*(?:pass\s*)?marks?|internal\s*marks?|external\s*marks?|duration\s*of\s*exam|time\s*allowed|prerequisites?|pre-requisites?|co-requisites?|text\s*books?|reference\s*books?|references?|recommended\s+reading|suggested\s+readings?)\b/i.test(
      stripped,
    ) ||
    /^(?:[a-z\s.&,'()-]+\b(?:university|college|institute|vidyapith|academy|polytechnic|school\s+of|faculty\s+of)\b.*|department\s+of\b.*|(?:programme|program|degree|branch|specialization|regulation|curriculum)\s*[:–-].*|(?:b\.?\s*tech|b\.?\s*e|m\.?\s*tech|m\.?\s*e|b\.?\s*sc|m\.?\s*sc|bca|mca|mba)\b.*)$/i.test(
      stripped,
    )
  );
}

function matchExplicitUnitHeading(line: string): RegExpMatchArray | null {
  const normLine = normalizeHeadingChars(line);
  if (
    isOutcomeOrObjectiveLine(normLine) ||
    isMetadataSectionHeading(normLine) ||
    POST_SYLLABUS_BOUNDARY_REGEX.test(normLine) ||
    isBoilerplateLine(normLine)
  ) {
    return null;
  }
  const m = normLine.match(UNIT_HEADING_REGEX);
  if (!m || !m[1]) return null;
  const rawRem = (m[2] ?? m[3] ?? "").replace(/^[\s:–.—-]+/, "").trim();
  if (
    rawRem &&
    (isMetadataSectionHeading(rawRem) ||
      isOutcomeOrObjectiveLine(rawRem) ||
      POST_SYLLABUS_BOUNDARY_REGEX.test(rawRem) ||
      isBoilerplateLine(rawRem))
  ) {
    return null;
  }
  return m;
}

/**
 * Enhanced syllabus parser that extracts individual topics strictly from recognized syllabus units.
 * Excludes Course Outcomes, Course Objectives, Program Outcomes, University/Course metadata, and References.
 */
export function parseSyllabus(text: string): SyllabusTopic[] {
  if (!text || !text.trim()) {
    throw new Error("No readable text found. Paste the syllabus text or enter topics manually.");
  }

  const units = extractSyllabusUnits(text);
  const topics = units.flatMap((u) => u.topics);
  if (!topics.length) {
    throw new Error("No topic lines found. Add topic names beneath each unit heading.");
  }
  return topics;
}

function cleanTitleOfCourseOutcomes(title: string): string {
  return title
    .replace(/\[\s*(?:(?:co|po|pso|course\s+outcomes?)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+\]/gi, "")
    .replace(/\(\s*(?:(?:co|po|pso|course\s+outcomes?)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+\)/gi, "")
    .replace(/\s*[-:–]\s*(?:(?:co|po|pso|course\s+outcomes?)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+$/gi, "")
    .replace(/\(\s*\d+\s*(?:hours?|hrs?|lectures?|periods?)\s*\)/gi, "")
    .replace(/\[\s*\d+\s*(?:hours?|hrs?|lectures?|periods?)\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnreadableScanLine(line: string): boolean {
  const stripped = line.replace(/\s+/g, "");
  if (stripped.length < 6) return false;
  if (/[^\w\s.,;:()/[\]-]{3,}/.test(stripped) || /[^\w\s]{4,}/.test(stripped)) return true;
  const alphaNumCount = (stripped.match(/[a-zA-Z0-9]/g) || []).length;
  const ratio = alphaNumCount / stripped.length;
  if (ratio < 0.4) return true;
  return false;
}

/**
 * Intelligent Unit Extractor for uploaded syllabus PDFs, Word documents, or pasted text.
 * Extracts actual syllabus units starting from "Unit I" and ending at the end of "Unit IV", inclusive.
 * Ignores Course Outcomes, university/college names, course details, objectives, and trailing references.
 * Strictly uses provided syllabus content — never generates generic, assumed, or invented topics.
 */
export function extractSyllabusUnits(
  text: string,
  _subjectName = "",
  targetUnitCount?: number,
): ParsedUnit[] {
  if (!text || !text.trim()) {
    throw new Error(
      "No readable syllabus text found. Please upload a valid PDF or Word document, or paste your syllabus text.",
    );
  }

  // Pre-split inline Unit headings or trailing Course Outcomes / References on non-outcome lines
  const preSplitLines = text.split(/\r?\n/).flatMap((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return [];
    const withSplitMetadata = trimmed.replace(
      /([^\r\n])\s+\b((?:course\s+outcomes?|course\s+objectives?|program(?:me)?\s+outcomes?|program(?:me)?\s+specific\s+outcomes?|text\s*books?|reference\s*books?|references?)\s*(?:\([^)]*\))?\s*[:–-])/gi,
      "$1\n$2",
    );
    return withSplitMetadata.split(/\r?\n/).flatMap((segment) => {
      const seg = segment.trim();
      if (!seg) return [];
      if (isOutcomeOrObjectiveLine(seg) || isMetadataSectionHeading(seg)) {
        return [seg];
      }
      return seg
        .replace(
          /([^\r\n])\s+\b((?:unit|un1t|module|modu1e)\b(?:\s*[:–.—-]*\s*(?:no\b\.?|num(?:ber)?\b\.?|#))?[\s:–.—-]*(?:0?[1-9]\d*|[ivx]+|one|two|three|four|five)\b\s*(?:[:–.—-]\s*)+)/gi,
          "$1\n$2",
        )
        .split(/\r?\n/);
    });
  });

  const rawLines = preSplitLines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  if (rawLines.length === 0) {
    throw new Error(
      "The syllabus document contains no readable lines. Please upload a valid PDF or Word document, or paste your syllabus text.",
    );
  }

  const postSyllabusBoundaryRegex = POST_SYLLABUS_BOUNDARY_REGEX;
  const isOutcomeLineRegex = isOutcomeOrObjectiveLine;

  // Merge wrapped continuation lines inside topic paragraphs (e.g. lines ending with comma or preposition)
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    let curr = rawLines[i]!;
    while (
      i + 1 < rawLines.length &&
      (!matchExplicitUnitHeading(curr) || /,\s*$/.test(curr)) &&
      !isOutcomeLineRegex(curr) &&
      !isMetadataSectionHeading(curr) &&
      !postSyllabusBoundaryRegex.test(curr) &&
      !isBoilerplateLine(curr) &&
      !isUnreadableScanLine(curr) &&
      (/(?:[,;–-]|\b(?:and|or|of|in|to|for|with|on|by|from|vs|&))\s*$/i.test(curr) ||
        (!matchExplicitUnitHeading(curr) && /^[a-z]/.test(rawLines[i + 1]!) && !/[.;]$/.test(curr)))
    ) {
      const next = rawLines[i + 1]!;
      if (
        matchExplicitUnitHeading(next) !== null ||
        isOutcomeLineRegex(next) ||
        isMetadataSectionHeading(next) ||
        postSyllabusBoundaryRegex.test(next) ||
        isBoilerplateLine(next) ||
        isUnreadableScanLine(next) ||
        /^[•*–o>·-]\s*|^\d+[.)]\s*|^[a-z][.)]\s*/i.test(next)
      ) {
        break;
      }
      curr = `${curr.replace(/-\s*$/, "")} ${next}`;
      i++;
    }
    lines.push(curr);
  }

  const unitsMap = new Map<
    number,
    {
      title: string;
      hasExplicitTitle: boolean;
      rawHeading: string;
      topics: SyllabusTopic[];
      flaggedNotes: string[];
    }
  >();

  let currentUnitNum = 0;
  let currentUnitTitle = "";
  let inNonSyllabusSection = false;

  const maxTargetUnit = 4; // Syllabus range spans Unit I through Unit IV, inclusive

  const parseAndPushTopicLine = (rawTopicText: string, unitNum: number) => {
    if (unitNum <= 0 || !unitsMap.has(unitNum)) return;
    const clean = rawTopicText.replace(/^[•*–o>·-]\s*|^\d+[.)]\s*|^[a-z][.)]\s*/i, "").trim();
    if (!clean || clean.length < 2) return;
    if (
      isOutcomeLineRegex(clean) ||
      isMetadataSectionHeading(clean) ||
      postSyllabusBoundaryRegex.test(clean) ||
      isBoilerplateLine(clean)
    ) {
      return;
    }

    const detectedMarks = rawTopicText.match(/\b\d+(?:\.\d+)?\s*(?:marks|%)\b/i)?.[0] ?? "";
    const cleanWithoutCo = cleanTitleOfCourseOutcomes(clean);
    if (!cleanWithoutCo || cleanWithoutCo.length < 2) return;
    if (
      isOutcomeLineRegex(cleanWithoutCo) ||
      isMetadataSectionHeading(cleanWithoutCo) ||
      postSyllabusBoundaryRegex.test(cleanWithoutCo) ||
      isBoilerplateLine(cleanWithoutCo)
    ) {
      return;
    }

    const colonIdx = cleanWithoutCo.indexOf(":");
    let topicName = cleanWithoutCo;
    let subtopics: string[] = [];

    if (colonIdx > 0 && colonIdx < 80) {
      topicName = cleanWithoutCo
        .slice(0, colonIdx)
        .replace(/[\s:–.—-]+$/, "")
        .trim();
      const rest = cleanWithoutCo
        .slice(colonIdx + 1)
        .replace(/^[\s:–.—-]+/, "")
        .trim();
      if (rest) {
        subtopics = rest
          .split(/[,;]\s*/)
          .map((s) => s.replace(/\.$/, "").trim())
          .filter(Boolean);
      }
    } else if (cleanWithoutCo.includes(",") || cleanWithoutCo.includes(";")) {
      const parts = cleanWithoutCo
        .split(/[,;]\s*/)
        .map((s) => s.replace(/\.$/, "").trim())
        .filter(Boolean);
      if (parts.length > 1) {
        topicName = parts[0]!;
        subtopics = parts;
      }
    }

    const romanUnitLabel = toRomanUnit(unitNum);
    const topicItem: SyllabusTopic = {
      id: `topic-${uid()}`,
      name: topicName,
      unit: romanUnitLabel,
      unitNumber: unitNum,
      subtopics: subtopics.length > 0 ? subtopics : [topicName],
      marks: detectedMarks,
      objectives: "",
      difficulty: "Medium",
      importance: detectedMarks ? "High" : "Medium",
      status: "Not Started",
      priorityVerified: Boolean(detectedMarks),
    };

    unitsMap.get(unitNum)!.topics.push(topicItem);
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;

    // 1. Check if this line is an explicit syllabus Unit heading (Unit I, Unit 1, Unit :- 1, UNIT-II, etc.)
    const match = matchExplicitUnitHeading(line);
    if (match && match[1]) {
      const parsedNum = parseUnitNumber(match[1]);

      // Stop extracting when a unit beyond Unit IV (e.g., Unit V) begins
      if (parsedNum > maxTargetUnit) {
        currentUnitNum = 0;
        break;
      }

      inNonSyllabusSection = false;
      currentUnitNum = parsedNum;

      // Extract title (and potential inline topics) from same line if present
      const rawRemainder = (match[2] ?? match[3] ?? "").replace(/^[\s:–.—-]+/, "").trim();
      let extractedTitle = cleanTitleOfCourseOutcomes(rawRemainder);
      let inlineTopicsFromHeader = "";

      // Check if header line contains "Title: Topic1, Topic2" or "Title - Topic1, Topic2"
      const secondColon = extractedTitle.indexOf(":");
      const dashSepMatch = extractedTitle.match(/^([^,;:]{3,65}?)\s+[-–—]\s+(.+)$/);
      if (secondColon > 0 && secondColon < 70) {
        inlineTopicsFromHeader = extractedTitle
          .slice(secondColon + 1)
          .replace(/^[\s:–.—-]+/, "")
          .trim();
        extractedTitle = extractedTitle
          .slice(0, secondColon)
          .replace(/[\s:–.—-]+$/, "")
          .trim();
      } else if (dashSepMatch && dashSepMatch[1] && dashSepMatch[2]) {
        extractedTitle = dashSepMatch[1].replace(/[\s:–.—-]+$/, "").trim();
        inlineTopicsFromHeader = dashSepMatch[2].replace(/^[\s:–.—-]+/, "").trim();
      } else if (extractedTitle.includes(",") || extractedTitle.includes(";")) {
        inlineTopicsFromHeader = extractedTitle;
        extractedTitle = extractedTitle.split(/[,;]/)[0]?.trim() || extractedTitle;
      }

      // If unit title is empty on this line, check if subsequent line contains unit title
      if (!extractedTitle && idx + 1 < lines.length) {
        const nextLine = lines[idx + 1]!;
        const lineAfterNext = idx + 2 < lines.length ? lines[idx + 2]! : "";
        const nextIsAnotherUnitOrEnd =
          !lineAfterNext ||
          matchExplicitUnitHeading(lineAfterNext) !== null ||
          postSyllabusBoundaryRegex.test(lineAfterNext) ||
          isOutcomeLineRegex(lineAfterNext) ||
          isMetadataSectionHeading(lineAfterNext);
        const nextLooksLikeTopicList =
          nextLine.includes(",") || nextLine.includes(";") || nextLine.includes(":");
        const lineAfterLooksLikeTopicListOrBullets =
          lineAfterNext.includes(",") ||
          lineAfterNext.includes(";") ||
          lineAfterNext.includes(":") ||
          /^[•*–o>·-]\s*|^\d+[.)]\s*/.test(lineAfterNext);

        if (
          matchExplicitUnitHeading(nextLine) === null &&
          !postSyllabusBoundaryRegex.test(nextLine) &&
          !isOutcomeLineRegex(nextLine) &&
          !isMetadataSectionHeading(nextLine) &&
          !isBoilerplateLine(nextLine) &&
          !/^[•*–o>·-]\s*|^\d+[.)]\s*/.test(nextLine) &&
          nextLine.length > 2 &&
          nextLine.length < 140
        ) {
          if (nextLooksLikeTopicList) {
            // The line beneath "Unit I" is a list of topics (or "Title: topics")
            inlineTopicsFromHeader = nextLine.replace(/^[\s:–.—-]+/, "").trim();
            const firstPart = inlineTopicsFromHeader.split(/[,;:]/)[0]?.trim() || "";
            extractedTitle = firstPart;
            idx++;
          } else if (!nextIsAnotherUnitOrEnd && !lineAfterLooksLikeTopicListOrBullets) {
            // Multiple plain lines beneath a bare "Unit X" heading: keep first line as both title and first topic
            extractedTitle = nextLine.replace(/^[\s:–.—-]+/, "").trim();
            inlineTopicsFromHeader = extractedTitle;
            idx++;
          } else {
            extractedTitle = nextLine.replace(/^[\s:–.—-]+/, "").trim();
            idx++;
          }
        }
      }

      const cleanedTitle = cleanTitleOfCourseOutcomes(extractedTitle) || extractedTitle;
      const hasExplicitTitle = Boolean(cleanedTitle);
      currentUnitTitle = cleanedTitle || toRomanUnit(currentUnitNum);

      if (!unitsMap.has(currentUnitNum)) {
        unitsMap.set(currentUnitNum, {
          title: currentUnitTitle,
          hasExplicitTitle,
          rawHeading: line,
          topics: [],
          flaggedNotes: [],
        });
      } else {
        const existing = unitsMap.get(currentUnitNum)!;
        if (!existing.hasExplicitTitle && hasExplicitTitle) {
          existing.title = currentUnitTitle;
          existing.hasExplicitTitle = true;
        }
      }

      if (inlineTopicsFromHeader) {
        parseAndPushTopicLine(inlineTopicsFromHeader, currentUnitNum);
      }
      continue;
    }

    // 2. Stop the current unit when any non-syllabus section begins (Course Outcomes, Course Objectives,
    // Program Outcomes, References, Textbooks, Assessment/Evaluation scheme, etc.)
    if (
      isMetadataSectionHeading(line) ||
      isOutcomePreambleLine(line) ||
      postSyllabusBoundaryRegex.test(line)
    ) {
      inNonSyllabusSection = true;
      currentUnitNum = 0;
      continue;
    }

    // 3. Explicitly exclude individual Course Outcome (CO1–CO6) and Program Outcome (PO/PSO) lines
    if (isOutcomeLineRegex(line)) {
      continue;
    }

    // 4. Only extract topics within the boundaries of a recognized syllabus unit
    if (inNonSyllabusSection || currentUnitNum <= 0 || !unitsMap.has(currentUnitNum)) {
      continue;
    }

    // 5. Skip common document boilerplate/metadata (University Name, Course Details, Credits, etc.)
    if (isBoilerplateLine(line)) {
      continue;
    }

    // 6. Detect unreadable scan artifacts inside a recognized unit
    if (isUnreadableScanLine(line)) {
      const note = `Unreadable scan artifact: "${line.slice(0, 45)}..."`;
      unitsMap.get(currentUnitNum)!.flaggedNotes.push(note);
      continue;
    }

    parseAndPushTopicLine(line, currentUnitNum);
  }

  // Require at least one explicit recognized syllabus unit; never treat Course Outcomes or unassigned lines as units
  if (unitsMap.size === 0) {
    throw new Error(
      "Could not detect any units or topics starting from Unit I in the syllabus text. Only explicit Unit headings (such as Unit I, Unit 1, Unit :- 1, or UNIT-II) are recognized, and Course Outcomes or metadata are excluded.",
    );
  }

  function formatUnitLabel(rawHeading: string, unitNum: number): string {
    if (/\b(?:unit|un1t)\b/i.test(rawHeading) && /[ivx]+/i.test(rawHeading)) {
      return toRomanUnit(unitNum);
    }
    if (
      /\b(?:unit|un1t|module|modu1e)\b(?:\s*[:–.—-]*\s*(?:no\b\.?|num(?:ber)?\b\.?|#))?[\s:–.—-]*\d+\b/i.test(
        rawHeading,
      )
    ) {
      return `Unit ${unitNum}`;
    }
    return toRomanUnit(unitNum);
  }

  // Case 2: Explicit units were identified within the Unit I..Unit IV scope
  const maxDetected = Math.max(...unitsMap.keys());
  let targetLimit = 4; // Bounded strictly between Unit I and Unit IV
  if (
    maxDetected < 4 &&
    !/\b(?:unit|un1t|u\s*n\s*i\s*t|module|modu1e)\b(?:\s*[:–.—-]*\s*(?:no\b\.?|num(?:ber)?\b\.?|#))?[\s:–.—-]*(?:iv|4|four|[1l|!]v)\b/i.test(
      text,
    )
  ) {
    targetLimit = maxDetected;
  }

  const examUnitLimit = targetUnitCount && targetUnitCount > 0 ? targetUnitCount : targetLimit;

  const expectedUnits: number[] = [];
  for (let u = 1; u <= targetLimit; u++) {
    expectedUnits.push(u);
  }

  return expectedUnits.map((unitNum, index) => {
    const data = unitsMap.get(unitNum);
    const unitLabel = data ? formatUnitLabel(data.rawHeading, unitNum) : toRomanUnit(unitNum);

    // If a unit in the required range is missing, flag it for verification without inventing content
    if (!data) {
      return {
        id: `unit-${unitNum}`,
        unitNumber: unitNum,
        unitLabel,
        title: `${unitLabel} (Missing in syllabus — please verify)`,
        topics: [],
        selectedForExam: index < examUnitLimit,
        flaggedNotes: [
          `${unitLabel} was not detected in the syllabus text. Please verify and enter topics manually.`,
        ],
      };
    }

    // If a unit had comma-separated topics inside its title and no separate topic lines, split them
    if (
      data.topics.length === 0 &&
      data.hasExplicitTitle &&
      (data.title.includes(",") || data.title.includes(";"))
    ) {
      parseAndPushTopicLine(data.title, unitNum);
    }

    // If an extracted unit has no bullet topics:
    // - If it has an explicit title, preserve that exact title as its topic.
    // - If it had neither a title nor topics (just a bare "Unit I" heading), flag it with topics: [] instead of guessing!
    let topics: SyllabusTopic[] = data.topics;
    const notes = [...data.flaggedNotes];

    if (topics.length === 0) {
      if (data.hasExplicitTitle && data.title && data.title !== unitLabel) {
        topics = [
          {
            id: `unit-${unitNum}-topic-1-${uid()}`,
            name: data.title,
            unit: unitLabel,
            unitNumber: unitNum,
            subtopics: [data.title],
            marks: "",
            objectives: "",
            difficulty: "Medium" as const,
            importance: "Medium" as const,
            status: "Not Started" as const,
            priorityVerified: false,
          },
        ];
      } else {
        notes.push(
          `No topics were identified under ${unitLabel}. Please click edit to verify and enter topics.`,
        );
      }
    }

    return {
      id: `unit-${unitNum}`,
      unitNumber: unitNum,
      unitLabel,
      title: data.title,
      topics,
      selectedForExam: index < examUnitLimit,
      flaggedNotes: notes.length > 0 ? notes : undefined,
    };
  });
}

/**
 * Standard curriculum generator for engineering and university subjects
 * Used when a user enters subject name without uploading an explicit PDF
 */
export function generateCurriculumUnitsForSubject(
  subjectName: string,
  unitCount = 5,
): ParsedUnit[] {
  const norm = normalize(subjectName);
  const units: ParsedUnit[] = [];
  const count = Math.min(10, Math.max(1, unitCount));

  interface SubjectCurriculum {
    title: string;
    subtopics: string[];
    difficulty: "Easy" | "Medium" | "Hard";
  }

  let curriculumTemplates: SubjectCurriculum[] = [];

  if (norm.includes("software") || norm.includes("se")) {
    curriculumTemplates = [
      {
        title: "Software Process Models, SDLC & Agile Methodologies",
        subtopics: [
          "Waterfall, Spiral, V-Model",
          "Agile Principles & Scrum Lifecycle",
          "Sprint Planning & User Stories",
        ],
        difficulty: "Easy",
      },
      {
        title: "Requirement Engineering, System Modeling & UML",
        subtopics: [
          "Functional & Non-Functional Requirements",
          "Use Case, Sequence & Class Diagrams",
          "SRS Documentation Standards",
        ],
        difficulty: "Medium",
      },
      {
        title: "Software Architectural Design & Patterns",
        subtopics: [
          "Layered & Microservices Architectures",
          "Creational, Structural & Behavioral Patterns",
          "Cohesion & Coupling Metrics",
        ],
        difficulty: "Hard",
      },
      {
        title: "Software Testing, Verification & Quality Assurance",
        subtopics: [
          "Black Box & White Box Testing",
          "Unit, Integration & System Testing",
          "Code Coverage & Regression Testing",
        ],
        difficulty: "Medium",
      },
      {
        title: "Project Estimation, Maintenance & DevOps Lifecycle",
        subtopics: [
          "COCOMO Estimation Model",
          "Risk Management & Mitigation",
          "CI/CD Pipelines & Version Control",
        ],
        difficulty: "Medium",
      },
    ];
  } else if (norm.includes("data structure") || norm.includes("dsa") || norm.includes("algo")) {
    curriculumTemplates = [
      {
        title: "Asymptotic Notation, Arrays & Stacks/Queues",
        subtopics: [
          "Big-O, Omega & Theta Complexities",
          "Stack Applications & Infix/Postfix",
          "Circular Queue & Priority Queues",
        ],
        difficulty: "Easy",
      },
      {
        title: "Linked Lists, Doubly Linked Lists & Hash Tables",
        subtopics: [
          "Singly & Doubly Linked Operations",
          "Collision Resolution & Open Addressing",
          "Hash Functions & Load Factor",
        ],
        difficulty: "Medium",
      },
      {
        title: "Trees, Binary Search Trees & AVL Balancing",
        subtopics: [
          "Binary Tree Traversals (Inorder/Pre/Post)",
          "BST Insert, Delete & Search",
          "AVL Rotations & B-Trees",
        ],
        difficulty: "Hard",
      },
      {
        title: "Graph Algorithms, BFS/DFS & Shortest Paths",
        subtopics: [
          "Adjacency Matrix & Adjacency List",
          "Breadth-First & Depth-First Traversal",
          "Dijkstra's Algorithm & Kruskal/Prim",
        ],
        difficulty: "Hard",
      },
      {
        title: "Sorting, Searching & Dynamic Programming Paradigms",
        subtopics: [
          "QuickSort & MergeSort Analysis",
          "0/1 Knapsack Problem & Memoization",
          "Longest Common Subsequence (LCS)",
        ],
        difficulty: "Hard",
      },
    ];
  } else if (norm.includes("os") || norm.includes("operating")) {
    curriculumTemplates = [
      {
        title: "Operating System Architecture & System Calls",
        subtopics: [
          "Monolithic vs Microkernel Kernels",
          "User Mode vs Kernel Mode Dual Operation",
          "Process Control Block (PCB)",
        ],
        difficulty: "Easy",
      },
      {
        title: "CPU Scheduling Algorithms & Threading",
        subtopics: [
          "FCFS, SJF, Round Robin & Priority Scheduling",
          "Gantt Charts & Average Turnaround/Wait Times",
          "Multithreading Models & Context Switching",
        ],
        difficulty: "Medium",
      },
      {
        title: "Process Synchronization & Deadlock Management",
        subtopics: [
          "Critical Section Problem & Semaphores",
          "Peterson's Algorithm & Monitors",
          "Banker's Algorithm & Deadlock Detection",
        ],
        difficulty: "Hard",
      },
      {
        title: "Memory Management, Paging & Virtual Memory",
        subtopics: [
          "Contiguous Allocation & Fragmentation",
          "Paging Architecture & Translation Lookaside Buffer (TLB)",
          "Page Replacement Algorithms (FIFO, LRU, Optimal)",
        ],
        difficulty: "Hard",
      },
      {
        title: "File Systems, Disk Scheduling & I/O Systems",
        subtopics: [
          "File Allocation Methods (Contiguous, Linked, Indexed)",
          "SCAN, C-SCAN, LOOK & SSTF Disk Scheduling",
          "RAID Architecture Levels",
        ],
        difficulty: "Medium",
      },
    ];
  } else if (norm.includes("dbms") || norm.includes("database") || norm.includes("sql")) {
    curriculumTemplates = [
      {
        title: "ER Modeling, Relational Algebra & Database Design",
        subtopics: [
          "Entities, Relationships & Cardinality",
          "Relational Operators (Selection, Projection, Joins)",
          "Keys: Primary, Candidate & Foreign Keys",
        ],
        difficulty: "Easy",
      },
      {
        title: "Advanced SQL Queries, Subqueries & Views",
        subtopics: [
          "Complex Joins, Aggregations & Group By",
          "Correlated Subqueries & Exists Operator",
          "Triggers, Procedures & Views",
        ],
        difficulty: "Medium",
      },
      {
        title: "Functional Dependencies & Relational Normalization",
        subtopics: [
          "1NF, 2NF, 3NF & Boyce-Codd Normal Form (BCNF)",
          "Lossless Join Decomposition",
          "Dependency Preservation Testing",
        ],
        difficulty: "Hard",
      },
      {
        title: "Transaction Processing, ACID & Concurrency Control",
        subtopics: [
          "Schedules: Serializability & Conflict Serial",
          "Two-Phase Locking Protocol (2PL)",
          "Deadlock Prevention & Timestamp Ordering",
        ],
        difficulty: "Hard",
      },
      {
        title: "Indexing, B+ Trees & Query Optimization",
        subtopics: [
          "Primary vs Secondary Indexing",
          "B-Tree & B+ Tree Search/Insert Operations",
          "Query Cost Estimation & Hash Indexes",
        ],
        difficulty: "Medium",
      },
    ];
  } else if (norm.includes("network") || norm.includes("cn")) {
    curriculumTemplates = [
      {
        title: "Network Architectures, OSI & TCP/IP Reference Models",
        subtopics: [
          "7-Layer OSI Model vs TCP/IP Suite",
          "Packet Switching vs Circuit Switching",
          "Network Topologies & Performance Latency",
        ],
        difficulty: "Easy",
      },
      {
        title: "Data Link Layer, Framing, Error Detection & MAC",
        subtopics: [
          "CRC Checksum & Parity Checking",
          "Sliding Window Protocols: Go-Back-N & Selective Repeat",
          "CSMA/CD & Ethernet Standards",
        ],
        difficulty: "Medium",
      },
      {
        title: "Network Layer, IPv4/IPv6 Addressing & Subnetting",
        subtopics: [
          "Classless Inter-Domain Routing (CIDR) & Subnet Masks",
          "Routing Protocols: Distance Vector vs Link State (OSPF)",
          "ARP, RARP & ICMP Control Messages",
        ],
        difficulty: "Hard",
      },
      {
        title: "Transport Layer, TCP, UDP & Congestion Control",
        subtopics: [
          "TCP 3-Way Handshake & Connection Teardown",
          "Flow Control & Window Size Calculation",
          "Slow Start, Congestion Avoidance & Fast Retransmit",
        ],
        difficulty: "Hard",
      },
      {
        title: "Application Layer, DNS, HTTP/HTTPS & Security",
        subtopics: [
          "Domain Name System (DNS) Hierarchical Resolution",
          "HTTP/1.1 vs HTTP/2 vs HTTP/3 Methods & Headers",
          "Symmetric vs Asymmetric Encryption & TLS/SSL",
        ],
        difficulty: "Medium",
      },
    ];
  } else {
    // Universal template for general subjects
    curriculumTemplates = [
      {
        title: `${subjectName}: Foundational Principles & Core Concepts`,
        subtopics: ["Introductory Terminology", "Historical Frameworks", "Underlying Theorems"],
        difficulty: "Easy",
      },
      {
        title: `${subjectName}: Methodologies, Processes & Frameworks`,
        subtopics: ["Standard Procedures", "Analytical Techniques", "Core Formulas"],
        difficulty: "Medium",
      },
      {
        title: `${subjectName}: Core System Architecture & Analysis`,
        subtopics: ["Primary Components", "Interactions & Dependencies", "Problem Formulation"],
        difficulty: "Hard",
      },
      {
        title: `${subjectName}: Advanced Problems & Case Studies`,
        subtopics: ["Complex Scenarios", "High-Yield Exam Proofs", "Mathematical Models"],
        difficulty: "Hard",
      },
      {
        title: `${subjectName}: Practical Implementation & Review`,
        subtopics: ["Review Checkpoints", "Comprehensive Practice", "Sample Questions"],
        difficulty: "Medium",
      },
    ];
  }

  for (let i = 1; i <= count; i++) {
    const template = curriculumTemplates[(i - 1) % curriculumTemplates.length]!;
    const unitTitle = `Unit ${i}: ${template.title}`;

    const topicItem: SyllabusTopic = {
      id: `unit-${i}-topic-core-${uid()}`,
      name: template.title,
      unit: `Unit ${i}`,
      unitNumber: i,
      subtopics: template.subtopics,
      marks: "20%",
      objectives: "",
      difficulty: template.difficulty,
      importance: "High",
      status: "Not Started",
    };

    units.push({
      id: `unit-${i}`,
      unitNumber: i,
      unitLabel: `Unit ${i}`,
      title: template.title,
      topics: [topicItem],
      selectedForExam: true,
    });
  }

  return units;
}

function generateCurriculumTopicsForSubject(
  subjectName: string,
  unitCount: number,
): SyllabusTopic[] {
  const units = generateCurriculumUnitsForSubject(subjectName, unitCount);
  return units.flatMap((u) => u.topics);
}

/**
 * Filter topics by user's selected exam units and expand comma-separated topic lists
 * into individual schedulable syllabus topics with exact wording.
 */
export function buildTopicsFromSelectedUnits(
  units: ParsedUnit[],
  selectedUnitNumbers?: number[],
): Topic[] {
  const targetNumbers =
    selectedUnitNumbers ?? units.filter((u) => u.selectedForExam).map((u) => u.unitNumber);

  return units
    .filter((u) => targetNumbers.includes(u.unitNumber))
    .flatMap((u) =>
      u.topics.flatMap((t) => {
        const verified = t.priorityVerified ?? Boolean(t.marks?.trim());
        const isCommaSeparatedTopicList =
          t.subtopics &&
          t.subtopics.length > 1 &&
          normalize(t.subtopics[0] ?? "") === normalize(t.name);

        if (isCommaSeparatedTopicList) {
          return t.subtopics.map((item, idx) => ({
            id: idx === 0 ? t.id : `${t.id}-sub-${idx + 1}`,
            name: item,
            difficulty: t.difficulty,
            importance: t.importance,
            status: t.status,
            unit: u.unitLabel,
            unitNumber: u.unitNumber,
            subtopics: [item],
            priorityVerified: verified,
          }));
        }

        return [
          {
            id: t.id,
            name: t.name,
            difficulty: t.difficulty,
            importance: t.importance,
            status: t.status,
            unit: u.unitLabel,
            unitNumber: u.unitNumber,
            subtopics: t.subtopics,
            priorityVerified: verified,
          },
        ];
      }),
    );
}

export function paperYears(text: string) {
  return [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) ?? [])].filter(
    (y) => Number(y) <= new Date().getFullYear(),
  );
}

export function topicEvidence(topic: SyllabusTopic, papers: Paper[]) {
  const keys = [
    normalize(topic.name),
    ...(topic.subtopics ?? []).map((s) => normalize(s)).filter((k) => k.length > 3),
  ].filter(Boolean);
  return papers.filter((p) => {
    if (p.review !== "verified" || !p.text.trim() || !keys.length) return false;
    const hay = ` ${normalize(p.text)} `;
    return keys.some((k) => hay.includes(` ${k} `));
  });
}

export function intelligenceRanking(
  data: Intelligence,
  state: AppState,
  exam: Exam,
  today: string,
) {
  const analyzed = data.papers.filter((p) => p.review === "verified" && p.text.trim());
  return data.topics
    .map((t) => {
      const saved = exam.topics.find((x) => normalize(x.name) === normalize(t.name));
      const topic = { ...t, ...(saved ?? {}) };
      const evidence = topicEvidence(t, analyzed);
      let correct = 0,
        total = 0;
      for (const q of state.quizzes.filter(
        (q) => normalize(q.subject) === normalize(exam.subject),
      )) {
        for (const [name, v] of Object.entries(q.perTopic))
          if (normalize(name) === normalize(topic.name)) {
            correct += v.correct;
            total += v.total;
          }
      }
      const base = topicPriority(topic, exam, today, analyzed);
      const bonus = total && correct / total < 0.5 ? 6 : total && correct / total < 0.8 ? 3 : 0;
      const score = base.score + bonus;
      const level: PriorityLevel = score >= 22 ? "High" : score >= 14 ? "Medium" : "Low";
      const priorityVerified =
        evidence.length > 0 ||
        Boolean(topic.marks?.trim()) ||
        total > 0 ||
        topic.priorityVerified === true;
      return {
        topic: { ...topic, priorityVerified },
        evidence,
        score,
        level,
        correct,
        total,
        priorityVerified,
        provisional: analyzed.length < 3,
        reasons: [
          ...base.reasons,
          ...(total
            ? [`Quiz: ${correct}/${total} correct (+${bonus})`]
            : ["No saved quiz evidence"]),
          ...(evidence.length
            ? [`Exact topic wording found in ${evidence.length}/${analyzed.length} reviewed papers`]
            : ["Priority not verified by past papers; scheduled from syllabus structure"]),
        ],
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function mergeSyllabus(exam: Exam, topics: SyllabusTopic[]): Exam {
  const added = topics.filter(
    (t) => !exam.topics.some((x) => normalize(x.name) === normalize(t.name)),
  );
  return { ...exam, topics: [...exam.topics, ...added] };
}

export interface StrategyDay {
  date: string;
  budget: number;
  used: number;
  sessions: {
    topicId?: string;
    title: string;
    minutes: number;
    score: number;
    priority: PriorityLevel;
    unit?: string | undefined;
    topicName?: string | undefined;
    subtopics?: string[] | undefined;
    priorityVerified?: boolean | undefined;
  }[];
}

export function preparationStrategy(
  data: Intelligence,
  state: AppState,
  exam: Exam,
  selected: string[],
  now = new Date(),
) {
  const today = toISO(now);
  const ranking = intelligenceRanking(data, state, exam, today).filter((r) =>
    selected.includes(r.topic.id),
  );
  const days: StrategyDay[] = [];
  for (let date = today; date < exam.date && days.length < 60; date = addDays(date, 1)) {
    const reserved = (state.plan?.tasks ?? [])
      .filter(
        (t) =>
          t.date === date ||
          (date === today && t.done && t.completedAt === today && t.date !== date),
      )
      .reduce((n, t) => n + t.minutes, 0);
    const wall =
      date === today ? Math.max(0, 23 * 60 - now.getHours() * 60 - now.getMinutes()) : Infinity;
    days.push({
      date,
      budget: Math.max(0, Math.min(Math.floor(exam.hoursPerDay * 60) - reserved, wall)),
      used: 0,
      sessions: [],
    });
  }
  const incomplete: string[] = [];
  let index = 0;
  for (const r of ranking) {
    let remaining = estimateMinutes(r.topic) + 15;
    const unitPrefix = r.topic.unit && r.topic.unit !== "Unassigned" ? `${r.topic.unit}: ` : "";
    const distinctSubs = (r.topic.subtopics ?? []).filter(
      (s) => s.trim() && normalize(s) !== normalize(r.topic.name),
    );
    const subSuffix = distinctSubs.length > 0 ? ` — ${distinctSubs.join(", ")}` : "";
    while (remaining > 0 && index < days.length) {
      const day = days[index];
      if (!day) break;
      const breakMin = day.sessions.length ? 10 : 0;
      const free = day.budget - day.used - breakMin;
      if (free < 15) {
        index++;
        continue;
      }
      if (breakMin) {
        day.sessions.push({
          title: "Break — stretch and reset",
          minutes: 10,
          score: 0,
          priority: "Low",
          priorityVerified: true,
        });
        day.used += 10;
      }
      const minutes = Math.min(50, free, remaining);
      day.sessions.push({
        topicId: r.topic.id,
        title: `${remaining <= 15 ? "Quick recall" : "Study"}: ${unitPrefix}${r.topic.name}${subSuffix}`,
        minutes,
        score: r.score,
        priority: r.level,
        unit: r.topic.unit !== "Unassigned" ? r.topic.unit : undefined,
        topicName: r.topic.name,
        subtopics: r.topic.subtopics,
        priorityVerified: r.priorityVerified,
      });
      day.used += minutes;
      remaining -= minutes;
    }
    if (remaining > 0) incomplete.push(r.topic.name);
  }
  return { ranking, days: days.filter((d) => d.sessions.length), incomplete };
}

export function appendStrategy(
  plan: Plan | null,
  examId: string,
  days: StrategyDay[],
  today: string,
): Plan {
  const tasks = days.flatMap((d) =>
    d.sessions.map((s, i) => ({
      id: `intelligence-${examId}-${d.date}-${i}-${s.topicId ?? "break"}`,
      examId,
      topicId: s.topicId ?? "",
      title: s.title,
      date: d.date,
      minutes: s.minutes,
      priority: s.priority,
      score: s.score,
      kind: "learn" as const,
      done: false,
      unit: s.unit,
      topicName: s.topicName,
      subtopics: s.subtopics,
      priorityVerified: s.priorityVerified,
    })),
  );
  return {
    generatedAt: plan?.generatedAt ?? today,
    tasks: [
      ...(plan?.tasks ?? []),
      ...tasks.filter((t) => !plan?.tasks.some((p) => p.id === t.id)),
    ],
    unscheduled: plan?.unscheduled ?? [],
  };
}
