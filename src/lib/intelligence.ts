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
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
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

function parseUnitNumber(val: string): number {
  const clean = val.trim().toLowerCase();
  if (ROMAN_NUMERALS[clean]) return ROMAN_NUMERALS[clean];
  const num = parseInt(clean, 10);
  return isNaN(num) ? 1 : num;
}

/**
 * Enhanced syllabus parser that extracts individual topics while preserving unit context.
 */
export function parseSyllabus(text: string): SyllabusTopic[] {
  if (!text.trim())
    throw new Error("No readable text found. Paste the syllabus text or enter topics manually.");
  let unit = "Unassigned";
  const topics: SyllabusTopic[] = [];
  let last: SyllabusTopic | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[•*-]\s*/, "");
    if (!line || /^page\s+\d+$/i.test(line)) continue;
    if (/^(unit|module|chapter|section)\s*[-:–]?\s*(\d+|[ivx]+)\b/i.test(line)) {
      unit = line;
      last = undefined;
      continue;
    }
    if (/^(learning\s+)?(objectives?|outcomes?)\s*:/i.test(line)) {
      if (last) last.objectives = line;
      continue;
    }
    if (/^(marks|weight(age)?|distribution)\s*:/i.test(line)) {
      if (last) last.marks = line;
      continue;
    }
    const clean = line.replace(/^\d+[.)]\s*/, "");
    const [name, ...details] = clean.split(/:\s*/);
    if (!name?.trim()) continue;
    last = {
      id: `syllabus-${topics.length}-${normalize(name)}`,
      name: name.trim(),
      unit,
      subtopics: details
        .join(": ")
        .split(/[,;]\s*/)
        .filter(Boolean),
      marks: line.match(/\b\d+(?:\.\d+)?\s*(?:marks|%)\b/i)?.[0] ?? "",
      objectives: "",
      importance: "Medium",
      difficulty: "Medium",
      status: "Not Started",
    };
    topics.push(last);
  }
  if (!topics.length)
    throw new Error("No topic lines found. Add topic names beneath each unit heading.");
  return topics;
}

function extractCourseOutcomeCodes(str: string): string[] {
  const matches = str.match(/\b(?:co|course\s+outcome)\s*[-_.:]?\s*([1-9]\d?)\b/gi);
  if (!matches) return [];
  const cos = new Set<string>();
  for (const m of matches) {
    const numMatch = m.match(/([1-9]\d?)$/);
    if (numMatch && numMatch[1]) {
      cos.add(`CO${numMatch[1]}`);
    }
  }
  return Array.from(cos);
}

function cleanTitleOfCourseOutcomes(title: string): string {
  return title
    .replace(/\[\s*(?:(?:co|course\s+outcome)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+\]/gi, "")
    .replace(/\(\s*(?:(?:co|course\s+outcome)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+\)/gi, "")
    .replace(/\s*[-:–]\s*(?:(?:co|course\s+outcome)\s*[-_.:]?\s*\d+\s*[,;/]?\s*)+$/gi, "")
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
 * Intelligent Unit Extractor for uploaded syllabus PDFs.
 * Extracts actual syllabus starting from "Unit I" and ending at the end of "Unit IV", inclusive.
 * Ignores unrelated preamble before Unit I and trailing content after Unit IV.
 * Strictly uses provided syllabus content — never generates generic, assumed, or invented topics.
 */
export function extractSyllabusUnits(
  text: string,
  _subjectName = "",
  targetUnitCount?: number,
): ParsedUnit[] {
  if (!text || !text.trim()) {
    throw new Error(
      "No readable syllabus text found. Please upload a valid text-based syllabus PDF or enter topics manually.",
    );
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error(
      "The syllabus document contains no readable lines. Please upload a valid PDF or enter topics manually.",
    );
  }

  const unitsMap = new Map<
    number,
    {
      title: string;
      rawHeading: string;
      topics: SyllabusTopic[];
      courseOutcomes: string[];
      flaggedNotes: string[];
    }
  >();

  let currentUnitNum = 0;
  let currentUnitTitle = "";
  let currentRawHeading = "";
  let hasStartedUnitRange = false;
  const unassignedTopics: SyllabusTopic[] = [];
  const unassignedCourseOutcomes: string[] = [];
  const unassignedFlaggedNotes: string[] = [];

  // Match: Unit 1, Unit I, Unit - 1, Unit: 1, Module 1, Module I, Chapter 1, Section A, Part 1, etc.
  const unitRegex =
    /^(?:unit|un1t|u\s*n\s*i\s*t|module|modu1e|chapter|section|part)\s*[-:–.]?\s*([1-9]\d*|[ivx]+|[1l|]v|[1l|]{2,3}|[a-e])\b(?:\s*[:–.-]\s*(.*))?$/i;

  // Boundary markers indicating the conclusion of syllabus content after Unit IV
  const postSyllabusBoundaryRegex =
    /^(?:text\s*books?|reference\s*books?|references?|suggested\s*readings?|question\s*paper\s*pattern|examination\s*scheme|scheme\s*of\s*examination|internal\s*assessment|evaluation\s*scheme|practical\s*work|laboratory|experiments?|web\s*references?)\b/i;

  const maxTargetUnit = 4; // Syllabus range strictly spans Unit I through Unit IV, inclusive

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;

    // Check standalone Course Outcome lines (can occur before Unit I or within syllabus)
    const isOutcomeLine =
      /^(?:(?:course\s+)?outcomes?|cos?)\s*[:–-]/i.test(line) ||
      /^co\s*[-_.:]?\s*[1-9]\d?\s*[:–-]/i.test(line);

    if (isOutcomeLine) {
      const cos = extractCourseOutcomeCodes(line);
      if (cos.length > 0) {
        if (currentUnitNum > 0 && unitsMap.has(currentUnitNum)) {
          unitsMap.get(currentUnitNum)!.courseOutcomes.push(...cos);
        } else {
          unassignedCourseOutcomes.push(...cos);
        }
        continue;
      }
    }

    const match = line.match(unitRegex);
    if (match && match[1]) {
      const parsedNum = parseUnitNumber(match[1]);

      // If we encounter a unit beyond the maxTargetUnit (e.g. Unit V when target is Unit IV):
      // Ignore content after Unit IV as requested.
      if (parsedNum > maxTargetUnit) {
        break; // Stop parsing: reached end of Unit IV range!
      }

      hasStartedUnitRange = true;
      currentUnitNum = parsedNum;
      currentRawHeading = line;

      const headerCos = extractCourseOutcomeCodes(line);

      // Extract title from same line if present
      let extractedTitle = (match[2] || "").replace(/^[:–.-]\s*/, "").trim();

      // If unit title is empty on this line, check if subsequent line contains unit title
      if (!extractedTitle && idx + 1 < lines.length) {
        const nextLine = lines[idx + 1]!;
        if (
          !unitRegex.test(nextLine) &&
          !postSyllabusBoundaryRegex.test(nextLine) &&
          !/^[•*–o>·-]\s*|^\d+[.)]\s*/.test(nextLine) &&
          nextLine.length > 2 &&
          nextLine.length < 120
        ) {
          extractedTitle = nextLine.replace(/^[:–.-]\s*/, "").trim();
          const nextCos = extractCourseOutcomeCodes(nextLine);
          headerCos.push(...nextCos);
          idx++;
        }
      }

      const cleanedTitle = cleanTitleOfCourseOutcomes(extractedTitle) || extractedTitle;
      currentUnitTitle = cleanedTitle || toRomanUnit(currentUnitNum);

      if (!unitsMap.has(currentUnitNum)) {
        unitsMap.set(currentUnitNum, {
          title: currentUnitTitle,
          rawHeading: line,
          topics: [],
          courseOutcomes: headerCos,
          flaggedNotes: [],
        });
      } else {
        unitsMap.get(currentUnitNum)!.courseOutcomes.push(...headerCos);
      }
      continue;
    }

    // If we have not reached Unit I yet, ignore unrelated preamble content
    if (!hasStartedUnitRange) {
      continue;
    }

    // If we are at/after Unit IV and hit trailing post-syllabus reference sections:
    if (currentUnitNum >= maxTargetUnit && postSyllabusBoundaryRegex.test(line)) {
      break; // End of Unit IV reached, ignore trailing textbooks/references
    }

    // Detect unreadable scan artifacts
    if (isUnreadableScanLine(line)) {
      const note = `Unreadable scan artifact: "${line.slice(0, 45)}..."`;
      if (currentUnitNum > 0 && unitsMap.has(currentUnitNum)) {
        unitsMap.get(currentUnitNum)!.flaggedNotes.push(note);
      } else {
        unassignedFlaggedNotes.push(note);
      }
      continue;
    }

    // Skip common document boilerplate/metadata
    if (
      /^(?:page\s+\d+|course\s+code|credits?|textbooks?|references?|hours?:\s*\d+|prerequisites?|recommended\s+reading)/i.test(
        line,
      )
    ) {
      continue;
    }

    // Line beneath a unit in the Unit I..Unit IV range
    const clean = line.replace(/^[•*–o>·-]\s*|^\d+[.)]\s*|^[a-z][.)]\s*/, "").trim();
    if (!clean || clean.length < 2) continue;

    // Check for inline course outcomes in topic lines (e.g. "Process Scheduling [CO1]")
    const topicCos = extractCourseOutcomeCodes(clean);
    if (topicCos.length > 0 && currentUnitNum > 0 && unitsMap.has(currentUnitNum)) {
      unitsMap.get(currentUnitNum)!.courseOutcomes.push(...topicCos);
    }

    const cleanWithoutCo = cleanTitleOfCourseOutcomes(clean) || clean;

    const colonIdx = cleanWithoutCo.indexOf(":");
    let topicName = cleanWithoutCo;
    let subtopics: string[] = [];

    if (colonIdx > 0 && colonIdx < 80) {
      topicName = cleanWithoutCo.slice(0, colonIdx).trim();
      const rest = cleanWithoutCo.slice(colonIdx + 1).trim();
      if (rest) {
        subtopics = rest
          .split(/[,;]\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (cleanWithoutCo.includes(",") || cleanWithoutCo.includes(";")) {
      const parts = cleanWithoutCo
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        topicName = parts[0]!;
        subtopics = parts;
      }
    }

    const romanUnitLabel = toRomanUnit(currentUnitNum);
    const topicItem: SyllabusTopic = {
      id: `topic-${uid()}`,
      name: topicName,
      unit: romanUnitLabel,
      unitNumber: currentUnitNum,
      subtopics: subtopics.length > 0 ? subtopics : [topicName],
      marks: "",
      objectives: "",
      difficulty: "Medium",
      importance: "High",
      status: "Not Started",
    };

    if (currentUnitNum > 0 && unitsMap.has(currentUnitNum)) {
      unitsMap.get(currentUnitNum)!.topics.push(topicItem);
    } else {
      unassignedTopics.push(topicItem);
    }
  }

  // Case 1: No explicit "Unit X" headings found, but actual topic lines were extracted
  if (unitsMap.size === 0) {
    if (unassignedTopics.length === 0) {
      throw new Error(
        "Could not detect any units or topics starting from Unit I in the syllabus text. Please check the document or enter topics manually.",
      );
    }

    // Partition the REAL extracted topics into balanced units
    const desiredUnits = maxTargetUnit;
    const chunkSize = Math.max(1, Math.ceil(unassignedTopics.length / desiredUnits));
    const result: ParsedUnit[] = [];

    for (let u = 1; u <= desiredUnits; u++) {
      const slice = unassignedTopics.slice((u - 1) * chunkSize, u * chunkSize);
      if (slice.length === 0) continue;

      const unitRomanLabel = toRomanUnit(u);
      const unitTopics = slice.map((t, idx) => ({
        ...t,
        unit: unitRomanLabel,
        unitNumber: u,
        id: `unit-${u}-topic-${idx + 1}-${uid()}`,
      }));

      const unitCos = unassignedCourseOutcomes.filter((co) => co === `CO${u}`);

      result.push({
        id: `unit-${u}`,
        unitNumber: u,
        unitLabel: unitRomanLabel,
        title: unitTopics[0]?.name || unitRomanLabel,
        topics: unitTopics,
        selectedForExam: true,
        courseOutcomes:
          unitCos.length > 0
            ? unitCos
            : unassignedCourseOutcomes.length > 0
              ? unassignedCourseOutcomes
              : undefined,
        flaggedNotes:
          u === 1 && unassignedFlaggedNotes.length > 0 ? unassignedFlaggedNotes : undefined,
      });
    }

    return result;
  }

  function formatUnitLabel(rawHeading: string, unitNum: number): string {
    if (/\b(?:unit|un1t)\b/i.test(rawHeading) && /[ivx]+/i.test(rawHeading)) {
      return toRomanUnit(unitNum);
    }
    if (/\b(?:unit|un1t|module|modu1e)\s*[-:–.]?\s*\d+\b/i.test(rawHeading)) {
      return `Unit ${unitNum}`;
    }
    return toRomanUnit(unitNum);
  }

  // Case 2: Explicit units were identified within the Unit I..Unit IV scope
  const maxDetected = Math.max(...unitsMap.keys());
  let targetLimit = 4; // Bounded strictly between Unit I and Unit IV
  if (maxDetected < 4 && !/\b(?:unit|un1t|module)\s*[-:–.]?\s*(?:iv|4|1v)\b/i.test(text)) {
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

    // If a unit in the required range is missing from the scan, flag it for verification without inventing content
    if (!data) {
      return {
        id: `unit-${unitNum}`,
        unitNumber: unitNum,
        unitLabel,
        title: `${unitLabel} (Missing in scan — please verify)`,
        topics: [],
        selectedForExam: index < examUnitLimit,
        courseOutcomes: [`CO${unitNum}`],
        flaggedNotes: [
          `${unitLabel} was not detected in the uploaded syllabus. Please verify and enter topics manually.`,
        ],
      };
    }

    // If an extracted unit has no bullet topics, preserve the EXACT unit title as its topic
    // Do NOT invent generic filler topics!
    const topics: SyllabusTopic[] =
      data.topics.length > 0
        ? data.topics
        : [
            {
              id: `unit-${unitNum}-topic-1-${uid()}`,
              name: data.title || unitLabel,
              unit: unitLabel,
              unitNumber: unitNum,
              subtopics: [data.title || unitLabel],
              marks: "",
              objectives: "",
              difficulty: "Medium" as const,
              importance: "High" as const,
              status: "Not Started" as const,
            },
          ];

    // Resolve course outcomes
    let outcomes = Array.from(new Set(data.courseOutcomes));
    if (outcomes.length === 0 && unassignedCourseOutcomes.length > 0) {
      const matchingCo = unassignedCourseOutcomes.find((co) => co === `CO${unitNum}`);
      if (matchingCo) {
        outcomes = [matchingCo];
      }
    }

    return {
      id: `unit-${unitNum}`,
      unitNumber: unitNum,
      unitLabel,
      title: data.title,
      topics,
      selectedForExam: index < examUnitLimit,
      courseOutcomes: outcomes.length > 0 ? outcomes : undefined,
      flaggedNotes: data.flaggedNotes.length > 0 ? data.flaggedNotes : undefined,
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
 * Filter topics by user's selected exam units
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
      u.topics.map((t) => ({
        id: t.id,
        name: t.name,
        difficulty: t.difficulty,
        importance: t.importance,
        status: t.status,
        unit: u.unitLabel,
        unitNumber: u.unitNumber,
        subtopics: t.subtopics,
        courseOutcomes: u.courseOutcomes,
      })),
    );
}

export function paperYears(text: string) {
  return [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) ?? [])].filter(
    (y) => Number(y) <= new Date().getFullYear(),
  );
}

export function topicEvidence(topic: SyllabusTopic, papers: Paper[]) {
  const key = normalize(topic.name);
  return papers.filter(
    (p) =>
      p.review === "verified" &&
      p.text.trim() &&
      key &&
      ` ${normalize(p.text)} `.includes(` ${key} `),
  );
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
      const base = topicPriority(topic, exam, today);
      const bonus = total && correct / total < 0.5 ? 6 : total && correct / total < 0.8 ? 3 : 0;
      const score = base.score + bonus + Math.min(6, evidence.length * 2);
      const level: PriorityLevel = score >= 22 ? "High" : score >= 14 ? "Medium" : "Low";
      return {
        topic,
        evidence,
        score,
        level,
        correct,
        total,
        provisional: analyzed.length < 3,
        reasons: [
          ...base.reasons,
          ...(total
            ? [`Quiz: ${correct}/${total} correct (+${bonus})`]
            : ["No saved quiz evidence"]),
          ...(evidence.length
            ? [
                `Exact topic wording found in ${evidence.length}/${analyzed.length} reviewed papers (+${Math.min(6, evidence.length * 2)})`,
              ]
            : ["No verified topic appearance; syllabus-based recommendation"]),
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
        });
        day.used += 10;
      }
      const minutes = Math.min(50, free, remaining);
      day.sessions.push({
        topicId: r.topic.id,
        title: `${remaining <= 15 ? "Quick recall" : "Study"}: ${r.topic.name}`,
        minutes,
        score: r.score,
        priority: r.level,
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
