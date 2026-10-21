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

  it("extracts Course Outcomes (CO1, CO2) from headings and outcome lines, and preserves them on topics", () => {
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
    // Unit 1 Course Outcomes
    expect(units[0]!.courseOutcomes).toBeDefined();
    expect(units[0]!.courseOutcomes).toContain("CO1");
    expect(units[0]!.title).toBe("Operating System Principles");

    // Unit 2 Course Outcomes
    expect(units[1]!.courseOutcomes).toBeDefined();
    expect(units[1]!.courseOutcomes).toContain("CO2");
    expect(units[1]!.courseOutcomes).toContain("CO3");
    expect(units[1]!.title).toBe("Storage and File Systems");

    // Verify propagation to Topics
    const topics = buildTopicsFromSelectedUnits(units);
    expect(topics.length).toBeGreaterThan(0);
    expect(topics[0]!.courseOutcomes).toEqual(["CO1"]);
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

    // Course outcomes preserved
    expect(units[0]!.courseOutcomes).toEqual(["CO1"]);
    expect(units[1]!.courseOutcomes).toEqual(["CO2"]);
    expect(units[2]!.courseOutcomes).toEqual(["CO3"]);
    expect(units[3]!.courseOutcomes).toEqual(["CO4"]);
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
    expect(unit3.title).toContain("Missing in scan");
    expect(unit3.topics).toHaveLength(0); // Never guess missing topics!
    expect(unit3.flaggedNotes).toBeDefined();
    expect(unit3.flaggedNotes![0]).toMatch(/not detected/i);

    // Units 1, 2, 4 have their real extracted topics
    expect(units[0]!.topics.length).toBeGreaterThan(0);
    expect(units[1]!.topics.length).toBeGreaterThan(0);
    expect(units[3]!.topics.length).toBeGreaterThan(0);
  });
});
