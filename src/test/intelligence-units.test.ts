import { describe, expect, it } from "vitest";
import {
  extractSyllabusUnits,
  buildTopicsFromSelectedUnits,
  generateCurriculumUnitsForSubject,
} from "@/lib/intelligence";

describe("Syllabus Unit Extraction & Curriculum Generator", () => {
  it("extracts units, titles, and subtopics from syllabus text", () => {
    const sampleSyllabus = `
UNIT I: Software Process Models and Agile
Waterfall model, V-model, Spiral model
Agile development principles, Scrum framework, User stories

UNIT II: Requirement Engineering and UML Modeling
Functional and non-functional requirements, SRS documentation
Use case diagrams, Class diagrams, Sequence diagrams

UNIT III: Software Architectural Design and Patterns
Architectural styles, Microservices vs Monolith
Design patterns: Factory, Singleton, Observer

UNIT IV: Software Testing and Quality Assurance
Black-box testing, White-box testing, Unit testing
Integration testing, System testing, Code coverage

UNIT V: Software Maintenance and DevOps
Maintenance types, Refactoring techniques
CI/CD pipelines, Version control with Git
`;

    const units = extractSyllabusUnits(sampleSyllabus, "Software Engineering", 4);

    // Bounded strictly between Unit I and Unit IV (Unit V is ignored)
    expect(units).toHaveLength(4);
    expect(units[0]!.unitNumber).toBe(1);
    expect(units[0]!.title).toContain("Software Process Models and Agile");
    expect(units[0]!.topics.length).toBeGreaterThan(0);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4]);

    // Selected for exam should match targetUnitCount (all 4 selected)
    expect(units.filter((u) => u.selectedForExam)).toHaveLength(4);

    // Build topics only from the 4 selected units
    const topics = buildTopicsFromSelectedUnits(units);
    expect(topics.every((t) => (t.unitNumber ?? 0) <= 4)).toBe(true);
  });

  it("handles syllabi with Module notation and custom unit counts", () => {
    const moduleSyllabus = `
Module 1: Relational Database Concepts
Entity relationship model, Relational algebra

Module 2: Structured Query Language
DDL, DML, Joins, Subqueries

Module 3: Normalization Techniques
1NF, 2NF, 3NF, BCNF
`;

    const units = extractSyllabusUnits(moduleSyllabus, "DBMS", 2);

    expect(units).toHaveLength(3);
    expect(units[0]!.unitLabel).toBe("Unit 1");
    expect(units.filter((u) => u.selectedForExam)).toHaveLength(2);
  });

  it("throws clear error when syllabus text is empty or blank", () => {
    expect(() => extractSyllabusUnits("", "Engineering")).toThrow(/no readable syllabus text/i);
    expect(() => extractSyllabusUnits("   \n\n  ", "Engineering")).toThrow(
      /no readable syllabus text/i,
    );
  });

  it("throws clear error when text has no parseable units or topics", () => {
    const unparseable = `
Course Code: CS401
Textbooks: None
Page 1 of 1
`;
    expect(() => extractSyllabusUnits(unparseable, "CS401")).toThrow(
      /could not detect any units or topics/i,
    );
  });

  it("preserves exact unit title as topic and does NOT invent generic topics when unit has no sub-bullets", () => {
    const syllabusWithOnlyTitles = `
Unit 1: Quantum Computing Foundations
Unit 2: Quantum Algorithms and Complexity
`;
    const units = extractSyllabusUnits(syllabusWithOnlyTitles, "Quantum Physics");

    expect(units).toHaveLength(2);
    expect(units[0]!.title).toBe("Quantum Computing Foundations");
    expect(units[0]!.topics[0]!.name).toBe("Quantum Computing Foundations");
    // Ensure no fake topics were invented
    expect(units[0]!.topics).toHaveLength(1);
    expect(units[1]!.title).toBe("Quantum Algorithms and Complexity");
    expect(units[1]!.topics[0]!.name).toBe("Quantum Algorithms and Complexity");
  });

  it("successfully parses OCR-extracted syllabus text with scanned artifacts and bullets", () => {
    const ocrSyllabus = `
UN1T 1: Machine Learning Fundamentals
o Supervised vs Unsupervised Learning
* Linear Regression and Cost Functions
> Gradient Descent Optimization

UNIT 2: Deep Neural Networks and Architectures
o Multilayer Perceptrons and Backpropagation
o Convolutional Neural Networks for Vision
* Recurrent Neural Networks and Transformers
`;
    const units = extractSyllabusUnits(ocrSyllabus, "Machine Learning", 2);

    expect(units).toHaveLength(2);
    expect(units[0]!.unitNumber).toBe(1);
    expect(units[0]!.title).toContain("Machine Learning Fundamentals");
    expect(units[0]!.topics.length).toBeGreaterThan(0);
    expect(units[1]!.title).toContain("Deep Neural Networks");
  });

  it("generates realistic high-yield curriculum units when no PDF text is provided", () => {
    const units = generateCurriculumUnitsForSubject("Software Engineering", 5);

    expect(units).toHaveLength(5);
    expect(units[0]!.title).toContain("Software Process");
    expect(units[0]!.topics[0]!.subtopics?.length).toBeGreaterThan(0);
    expect(units.every((u) => u.selectedForExam)).toBe(true);
  });

  it("ignores Course Outcomes (CO1, CO2) in headings and outcome lines, extracting only units and topics", () => {
    const syllabusWithCO = `
UNIT 1: Operating System Principles [CO1]
Process Management, CPU Scheduling Algorithms
CO1: Understand core operating system architectures

UNIT 2: Storage and File Systems [CO2, CO3]
File Allocation Methods, Disk Scheduling
Course Outcomes: CO2, CO3
`;

    const units = extractSyllabusUnits(syllabusWithCO, "Operating Systems");

    expect(units).toHaveLength(2);
    // Unit 1: COs ignored, only unit title and topics extracted
    expect(units[0]!.courseOutcomes).toBeUndefined();
    expect(units[0]!.title).toBe("Operating System Principles");
    expect(units[0]!.topics.map((t) => t.name)).not.toContain(
      "CO1: Understand core operating system architectures",
    );

    // Unit 2: COs ignored, only unit title and topics extracted
    expect(units[1]!.courseOutcomes).toBeUndefined();
    expect(units[1]!.title).toBe("Storage and File Systems");

    // Verify topics do not include Course Outcomes
    const topics = buildTopicsFromSelectedUnits(units);
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0]!.courseOutcomes).toBeUndefined();
  });

  it("detects and flags unreadable OCR scanner noise lines instead of inventing junk topics", () => {
    const syllabusWithNoise = `
UNIT 1: Compiler Design Foundations
|!@#$$%^&*()!@#$$%^&~
Syntax Analysis, Context Free Grammars
`;

    const units = extractSyllabusUnits(syllabusWithNoise, "Compiler Design");

    expect(units).toHaveLength(1);
    expect(units[0]!.flaggedNotes).toBeDefined();
    expect(units[0]!.flaggedNotes!.length).toBeGreaterThan(0);
    expect(units[0]!.flaggedNotes![0]).toMatch(/unreadable scan/i);

    // Ensure the garbage line was NOT converted into a topic
    const topicNames = units[0]!.topics.map((t) => t.name);
    expect(topicNames.some((name) => name.includes("!@#$$%"))).toBe(false);
  });

  it("strictly extracts syllabus starting from Unit I and ending at Unit IV, ignoring preamble and trailing references", () => {
    const documentWithPreambleAndTrailing = `
UNIVERSITY OF TECHNOLOGY
Department of Computer Science & Engineering
Course Code: CS-402
Course Title: Distributed Operating Systems
Credits: 4  Hours/Week: 4
Course Outcomes: CO1, CO2, CO3, CO4
Prerequisites: Operating Systems, Computer Networks

UNIT I: Fundamentals of Distributed Systems
Introduction, System Models, Distributed Mutual Exclusion
Lamport's timestamps, Ricart-Agrawala algorithm

UNIT II: Distributed Deadlock and Concurrency Control
Deadlock handling strategies, Centralized and Distributed algorithms
Two-Phase Locking (2PL), Timestamp ordering

UNIT III: Distributed Shared Memory and File Systems
Architecture, Consistency models, Page-based DSM
NFS architecture, Andrew File System (AFS)

UNIT IV: Fault Tolerance and Consensus in Distributed Systems
Failure models, Byzantine Generals problem, Paxos consensus
Checkpointing and recovery techniques

UNIT V: Advanced Cloud Systems and Microservices
Kubernetes orchestration, Serverless computing, Edge networks

TEXT BOOKS:
1. Coulouris, Dollimore, Kindberg, "Distributed Systems: Concepts and Design"
2. Tanenbaum, Steen, "Distributed Systems: Principles and Paradigms"

REFERENCE BOOKS:
1. Singhal, Shivaratri, "Advanced Concepts in Operating Systems"

QUESTION PAPER PATTERN:
Max Marks: 100
Time: 3 Hours
`;

    const units = extractSyllabusUnits(documentWithPreambleAndTrailing, "Distributed Systems");

    // Exactly 4 units: Unit I through Unit IV
    expect(units).toHaveLength(4);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4]);

    // Unit titles preserve exact syllabus text
    expect(units[0]!.title).toBe("Fundamentals of Distributed Systems");
    expect(units[1]!.title).toBe("Distributed Deadlock and Concurrency Control");
    expect(units[2]!.title).toBe("Distributed Shared Memory and File Systems");
    expect(units[3]!.title).toBe("Fault Tolerance and Consensus in Distributed Systems");

    // Unit I does NOT contain preamble text as topics
    const u1Topics = units[0]!.topics.map((t) => t.name);
    expect(u1Topics.some((t) => /Department|Prerequisites|Course Title/i.test(t))).toBe(false);
    expect(u1Topics).toContain("Introduction");

    // Unit V and Textbooks are NOT included
    const allTopicNames = units.flatMap((u) => u.topics.map((t) => t.name));
    expect(
      allTopicNames.some((t) => /Kubernetes|Serverless|Coulouris|Tanenbaum|Marks/i.test(t)),
    ).toBe(false);

    // Course outcomes are not considered
    expect(units[0]!.courseOutcomes).toBeUndefined();
    expect(units[1]!.courseOutcomes).toBeUndefined();
    expect(units[2]!.courseOutcomes).toBeUndefined();
    expect(units[3]!.courseOutcomes).toBeUndefined();
  });

  it("identifies missing units in the Unit I..Unit IV range and flags them for verification without guessing", () => {
    // Scan where Unit III was missing
    const scannedDocMissingUnit3 = `
UNIT I: Foundations of Database Systems
Relational model, Relational algebra

UNIT II: SQL and Relational Query Processing
Joins, Subqueries, Aggregate functions

UNIT IV: Concurrency Control and Transactions
ACID properties, Serializability, Two-Phase Locking
`;

    const units = extractSyllabusUnits(scannedDocMissingUnit3, "Databases");

    expect(units).toHaveLength(4);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4]);

    // Unit III is flagged as missing for user verification with 0 guessed topics
    const unit3 = units.find((u) => u.unitNumber === 3)!;
    expect(unit3.title).toContain("Missing in");
    expect(unit3.topics).toHaveLength(0); // Never guess missing topics!
    expect(unit3.flaggedNotes).toBeDefined();
    expect(unit3.flaggedNotes![0]).toMatch(/not detected/i);

    // Units 1, 2, 4 have their real extracted topics
    expect(units[0]!.topics.length).toBeGreaterThan(0);
    expect(units[1]!.topics.length).toBeGreaterThan(0);
    expect(units[3]!.topics.length).toBeGreaterThan(0);
  });

  it("correctly groups unit headings with inline topics, different numbering formats, and wrapped line breaks", () => {
    const pastedSyllabus = `
Unit - I: Process Management: CPU scheduling, Process synchronization,
Threads and Concurrency
Unit-II - Memory Management - Paging, Virtual memory, Segmentation
Unit Three
Storage Systems, File allocation, Disk scheduling
Unit 4: Distributed Systems: Consensus, Fault tolerance
`;

    const units = extractSyllabusUnits(pastedSyllabus, "Operating Systems");

    expect(units).toHaveLength(4);
    expect(units[0]!.title).toBe("Process Management");
    expect(units[0]!.topics[0]!.subtopics).toContain("Threads and Concurrency");
    expect(units[1]!.title).toBe("Memory Management");
    expect(units[1]!.topics[0]!.subtopics).toContain("Virtual memory");
    expect(units[2]!.topics[0]!.subtopics).toContain("File allocation");
    expect(units[3]!.title).toBe("Distributed Systems");
    expect(units[3]!.topics[0]!.subtopics).toContain("Fault tolerance");
  });

  it("recognizes all unit heading formats (Unit 1, Unit I, UNIT-1, Unit: 1, Unit :- 1, Unit : - 1, Unit No. 1) regardless of capitalization or extra spaces", () => {
    const headingFormats = [
      "Unit 1",
      "Unit I",
      "UNIT-1",
      "Unit: 1",
      "Unit :- 1",
      "Unit : - 1",
      "Unit No. 1",
      "  uNiT   :  -   1  ",
      "  UNIT   NO.   I  ",
    ];

    for (const heading of headingFormats) {
      const syllabus = `
${heading}: Lexical Analysis [CO1]
Regular expressions, Finite automata, Lex tool
`;
      const units = extractSyllabusUnits(syllabus, "Compiler Design");
      expect(units).toHaveLength(1);
      expect(units[0]!.unitNumber).toBe(1);
      expect(units[0]!.title).toBe("Lexical Analysis");
      expect(units[0]!.courseOutcomes).toBeUndefined();
      expect(units[0]!.topics).toHaveLength(1);
      expect(units[0]!.topics[0]!.subtopics).toEqual([
        "Regular expressions",
        "Finite automata",
        "Lex tool",
      ]);
    }
  });

  it("correctly separates topics under Units I–IV across mixed heading styles without mixing content between units", () => {
    const mixedFormatSyllabus = `
  Unit :- 1 :- Introduction to Compilers [CO1]
Lexical Analysis: Tokens, Patterns, Lexemes
Finite Automata and Regular Expressions

  Unit : - 2 : - Syntax Analysis [CO2]
Context-Free Grammars, Top-Down Parsing
LL(1) Parsers, Bottom-Up LR Parsing

  Unit No. 3: Intermediate Code Generation [CO3]
Syntax-Directed Translation, Three-Address Code
Type Checking and Symbol Tables

  UNIT-4 : Code Optimization and Generation [CO4]
Basic Blocks and Flow Graphs, Peephole Optimization
Register Allocation and Instruction Selection
`;

    const units = extractSyllabusUnits(mixedFormatSyllabus, "Compiler Design");

    expect(units).toHaveLength(4);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4]);

    // Verify titles are preserved and Course Outcomes are ignored
    expect(units[0]!.title).toBe("Introduction to Compilers");
    expect(units[0]!.courseOutcomes).toBeUndefined();
    expect(units[1]!.title).toBe("Syntax Analysis");
    expect(units[1]!.courseOutcomes).toBeUndefined();
    expect(units[2]!.title).toBe("Intermediate Code Generation");
    expect(units[2]!.courseOutcomes).toBeUndefined();
    expect(units[3]!.title).toBe("Code Optimization and Generation");
    expect(units[3]!.courseOutcomes).toBeUndefined();

    // Verify topics are strictly separated under each unit with no cross-unit mixing
    expect(units[0]!.topics.map((t) => t.name)).toEqual([
      "Lexical Analysis",
      "Finite Automata and Regular Expressions",
    ]);
    expect(units[1]!.topics.map((t) => t.name)).toEqual(["Context-Free Grammars", "LL(1) Parsers"]);
    expect(units[2]!.topics.map((t) => t.name)).toEqual([
      "Syntax-Directed Translation",
      "Type Checking and Symbol Tables",
    ]);
    expect(units[3]!.topics.map((t) => t.name)).toEqual([
      "Basic Blocks and Flow Graphs",
      "Register Allocation and Instruction Selection",
    ]);
  });

  it("throws an error when no explicit Unit headings are present instead of treating Course Outcomes or loose lines as units", () => {
    const onlyCourseOutcomesAndNotes = `
NATIONAL INSTITUTE OF ENGINEERING
B.Tech Computer Science - Semester V
Course Objectives:
1. To introduce operating system kernel concepts
Course Outcomes:
CO1: Analyze CPU scheduling algorithms
CO2: Understand deadlock avoidance and memory paging
CO 3 - Design file system structures
CO-4: Evaluate disk scheduling mechanisms
Program Outcomes:
PO1: Engineering knowledge
PO2: Problem analysis
`;

    expect(() => extractSyllabusUnits(onlyCourseOutcomesAndNotes, "Operating Systems")).toThrow(
      /could not detect any units or topics/i,
    );
  });

  it("extracts only actual syllabus units (Unit I–IV) when Course Outcomes appear both BEFORE Unit I and AFTER Unit IV", async () => {
    const { generatePlan } = await import("@/lib/engine");
    const { parseSyllabus } = await import("@/lib/intelligence");

    const syllabusWithCOsBeforeAndAfter = `
JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY
Department of Computer Science and Engineering
Course Code: CS302   Course Title: Compiler Design
Course Objectives:
1. Understand the phases of a compiler and lexical analysis
2. Learn top-down and bottom-up parsing techniques
Course Outcomes (COs):
At the end of the course, the student will be able to:
CO1: Design lexical analyzers using deterministic finite automata
CO2: Construct LL(1) and LR parsers for context-free grammars
CO 3: Translate syntax trees into three-address intermediate code
CO-4: Apply peephole and loop optimization techniques
CO5: Analyze runtime stack allocation and garbage collection
CO6: Generate target assembly code
Program Outcomes: PO1, PO2, PO3, PSO1, PSO2

Unit I: Introduction to Compilers and Lexical Analysis
Phases of a Compiler, cousins of the compiler, grouping of phases
Lexical Analysis: Role of Lexical Analyzer, Input Buffering, Specification of Tokens, Recognition of Tokens, Lex, Finite Automata, Regular Expressions to Automata

Unit 2: Syntax Analysis
Context-Free Grammars, Writing a Grammar, Top-Down Parsing: Recursive Descent and Predictive Parsers, LL(1) Grammars
Bottom-Up Parsing: Shift-Reduce Parsing, Operator-Precedence Parsing, LR Parsers: SLR, Canonical LR, and LALR

Unit :- 3: Syntax-Directed Translation and Intermediate Code Generation
Syntax-Directed Definitions, Evaluation Orders for SDDs, Applications of Syntax-Directed Translation
Intermediate Languages: Syntax Trees, Three-Address Code, Types and Declarations, Translation of Expressions, Type Checking

UNIT-IV: Run-Time Environments and Code Optimization
Storage Organization, Stack Allocation of Space, Access to Nonlocal Data on the Stack, Heap Management
Principal Sources of Optimization, Optimization of Basic Blocks, Peephole Optimization, Loops in Flow Graphs

Course Outcomes:
Upon completion of this course, students will be able to:
CO1: Demonstrate knowledge of lexical analysis and scanner generation
CO2: Build top-down and bottom-up syntax analyzers
CO3: Generate intermediate code in three-address form
CO4: Apply code optimization on basic blocks and flow graphs
1. Acquire foundational knowledge of language translation
2. Apply formal grammar concepts to compiler construction
• Evaluate code generation algorithms for modern architectures
Program Specific Outcomes (PSOs):
PSO1: Design system software and language processors
CO-PO Mapping Matrix:
CO1 PO1 PO2
Text Books:
1. Alfred V. Aho, Monica S. Lam, Ravi Sethi, Jeffrey D. Ullman, "Compilers: Principles, Techniques, and Tools"
References:
1. Keith D. Cooper and Linda Torczon, "Engineering a Compiler"
`;

    const units = extractSyllabusUnits(syllabusWithCOsBeforeAndAfter, "Compiler Design");
    expect(units).toHaveLength(4);
    expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4]);
    expect(units[0]!.title).toBe("Introduction to Compilers and Lexical Analysis");
    expect(units[1]!.title).toBe("Syntax Analysis");
    expect(units[2]!.title).toBe("Syntax-Directed Translation and Intermediate Code Generation");
    expect(units[3]!.title).toBe("Run-Time Environments and Code Optimization");

    // Verify no unit title or topic contains Course Outcomes, CO1-CO6, Program Outcomes, or References
    const allUnitTitles = units.map((u) => u.title);
    expect(
      allUnitTitles.some((t) =>
        /Course Outcome|Course Objective|Program Outcome|\bCO\s*[-_.:]?\s*[1-6]\b|Text Book|Reference/i.test(
          t,
        ),
      ),
    ).toBe(false);

    const topics = buildTopicsFromSelectedUnits(units);
    const parsedDirect = parseSyllabus(syllabusWithCOsBeforeAndAfter);
    expect(topics.length).toBeGreaterThan(0);
    expect(parsedDirect.length).toBeGreaterThan(0);

    for (const t of [...topics, ...parsedDirect]) {
      expect(t.name).not.toMatch(
        /Course Outcome|Course Objective|Program Outcome|\bCO\s*[-_.:]?\s*[1-6]\b|Demonstrate knowledge|Acquire foundational|Evaluate code generation|Aho|Cooper|Jawaharlal/i,
      );
    }

    // Verify Unit IV specifically stopped before the trailing Course Outcomes section
    const unit4Topics = units[3]!.topics.flatMap((t) => [t.name, ...(t.subtopics ?? [])]);
    expect(unit4Topics).toContain("Peephole Optimization");
    expect(unit4Topics).toContain("Loops in Flow Graphs");
    expect(
      unit4Topics.some((t) =>
        /Demonstrate knowledge|Acquire foundational|Evaluate code generation|CO1|CO2|CO3|CO4|PSO1/i.test(
          t,
        ),
      ),
    ).toBe(false);

    // Study plan uses only the actual syllabus units (Units I–IV)
    const plan = generatePlan(
      [
        {
          id: "compiler-exam",
          name: "Compiler Design End-Sem",
          subject: "Compiler Design",
          date: "2026-10-25",
          hoursPerDay: 4,
          topics,
        },
      ],
      null,
      "2026-10-17",
    );
    expect(plan.tasks.length).toBeGreaterThan(0);
    for (const task of plan.tasks) {
      expect(task.title).not.toMatch(
        /Course Outcome|\bCO[1-6]\b|Demonstrate knowledge|Acquire foundational/i,
      );
      expect(task.unit).toMatch(/^Unit (I|1|II|2|III|3|IV|4)$/);
    }
  });

  it("builds a concrete topic-based daily study plan and Rescue Mode plan covering all units and verifying priority only with PYQ/marks evidence", async () => {
    const { generatePlan } = await import("@/lib/engine");
    const { rescueAnalysis } = await import("@/lib/rescue");

    const syllabusText = `
STATE TECHNOLOGICAL UNIVERSITY
Department of Computer Science
Course Code: CS501   Credits: 4
Course Objectives:
1. Understand database design and normalization
Course Outcomes:
CO1: Design ER models
CO2: Write SQL queries

Unit 1: ER Modeling and Relational Algebra
Entity-Relationship Diagrams: Entities, Attributes, Relationships
Relational Algebra Operations: Selection, Projection, Natural Join

Unit-II: SQL and Normalization
SQL Queries, Joins, Nested Subqueries
Functional Dependencies: 1NF, 2NF, 3NF, BCNF

Unit :- 3: Transaction Processing
ACID Properties, Schedules and Serializability
Concurrency Control: Two-Phase Locking, Timestamp Ordering

Unit IV: Indexing and Recovery
B+ Trees, Hash Indexing
Log-Based Recovery, Shadow Paging
`;

    const units = extractSyllabusUnits(syllabusText, "DBMS");
    expect(units).toHaveLength(4);

    const topics = buildTopicsFromSelectedUnits(units);
    // Comma-separated topic lines are expanded into individual concrete topics
    expect(topics.map((t) => t.name)).toContain("SQL Queries");
    expect(topics.map((t) => t.name)).toContain("Joins");
    expect(topics.map((t) => t.name)).toContain("Nested Subqueries");
    // Colon-delimited lines preserve topic + subtopics
    const erTopic = topics.find((t) => t.name === "Entity-Relationship Diagrams")!;
    expect(erTopic.subtopics).toEqual(["Entities", "Attributes", "Relationships"]);
    // Without PYQs or marks, priorityVerified is false ("Priority not verified")
    expect(topics.every((t) => t.priorityVerified === false)).toBe(true);

    const exam = {
      id: "dbms-exam",
      name: "DBMS End-Sem",
      subject: "DBMS",
      date: "2026-10-24",
      hoursPerDay: 4,
      topics,
    };

    // 1. Generate plan WITHOUT PYQ evidence
    const planWithoutPyq = generatePlan([exam], null, "2026-10-17");
    expect(planWithoutPyq.tasks.length).toBeGreaterThan(0);

    for (const task of planWithoutPyq.tasks) {
      // Never uses vague tasks like "Complete half of Unit 1" or "Finish the remaining unit"
      expect(task.title).not.toMatch(/complete half of unit|finish the remaining unit/i);
      // Every task has unit, exact topicName, priority, done boolean, and unverified priority flag
      expect(task.unit).toMatch(/^Unit (I|1|II|2|III|3|IV|4)$/);
      expect(task.topicName?.length).toBeGreaterThan(0);
      expect(["High", "Medium", "Low"]).toContain(task.priority);
      expect(typeof task.done).toBe("boolean");
      expect(task.priorityVerified).toBe(false);
    }

    // All 4 units are covered and tasks are distributed across multiple days
    const coveredUnits = new Set(planWithoutPyq.tasks.map((t) => t.unit));
    expect(coveredUnits.size).toBe(4);
    const scheduledDays = new Set(planWithoutPyq.tasks.map((t) => t.date));
    expect(scheduledDays.size).toBeGreaterThan(1);

    // 2. Generate plan WITH verified PYQ evidence for "Concurrency Control"
    const verifiedPapers = [
      {
        id: "p1",
        title: "2024 DBMS Paper",
        url: "https://uni.edu/2024.pdf",
        text: "Explain Concurrency Control and Two-Phase Locking in detail. Compare Two-Phase Locking with Timestamp Ordering.",
        year: "2024",
        review: "verified" as const,
      },
      {
        id: "p2",
        title: "2023 DBMS Paper",
        url: "https://uni.edu/2023.pdf",
        text: "Discuss Concurrency Control protocols and Two-Phase Locking.",
        year: "2023",
        review: "verified" as const,
      },
    ];

    const planWithPyq = generatePlan([exam], null, "2026-10-17", verifiedPapers);
    const ccTask = planWithPyq.tasks.find((t) => t.topicName === "Concurrency Control")!;
    const unverifiedTask = planWithPyq.tasks.find((t) => t.topicName === "Shadow Paging")!;
    expect(ccTask.priorityVerified).toBe(true);
    expect(unverifiedTask.priorityVerified).toBe(false);
    expect(ccTask.score).toBeGreaterThan(unverifiedTask.score);

    // 3. Rescue Mode uses parsed syllabus topics and respects PYQ evidence vs unverified priority
    const rescue = rescueAnalysis(
      {
        exams: [exam],
        plan: planWithPyq,
        quizzes: [],
        settings: { name: "Student" },
        intelligence: {
          university: "",
          course: "",
          semester: "",
          subject: "DBMS",
          examType: "End semester",
          examId: exam.id,
          topics: units.flatMap((u) => u.topics),
          papers: verifiedPapers,
        },
      },
      exam.id,
      new Date("2026-10-17T10:00:00"),
    );

    expect(rescue).not.toBeNull();
    expect(rescue!.top3[0]!.topic.name).toBe("Concurrency Control");
    expect(rescue!.top3[0]!.priorityVerified).toBe(true);
    expect(rescue!.top3[0]!.reasons.some((r) => /past question paper/i.test(r))).toBe(true);

    const shadowRescue = rescue!.ranked.find((r) => r.topic.name === "Shadow Paging")!;
    expect(shadowRescue.priorityVerified).toBe(false);
    expect(shadowRescue.reasons.some((r) => /priority not verified/i.test(r))).toBe(true);
  });
});
