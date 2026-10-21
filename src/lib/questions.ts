// Hand-written SAMPLE questions. These are not AI-generated.
export interface Question {
  id: string;
  subject: string;
  topic: string;
  q: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}

export const QUESTIONS: Question[] = [
  {
    id: "ds1",
    subject: "Data Structures",
    topic: "Trees & BST",
    q: "What is the worst-case search time in an unbalanced binary search tree with n nodes?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    answer: 2,
    explanation:
      "If keys are inserted in sorted order the BST degenerates into a linked list, so search is O(n).",
  },
  {
    id: "ds2",
    subject: "Data Structures",
    topic: "Stacks & Queues",
    q: "Which data structure is used to evaluate a postfix expression?",
    options: ["Queue", "Stack", "Heap", "Graph"],
    answer: 1,
    explanation:
      "Operands are pushed on a stack; each operator pops its operands and pushes the result.",
  },
  {
    id: "ds3",
    subject: "Data Structures",
    topic: "Graphs",
    q: "Breadth-first search on an unweighted graph finds…",
    options: [
      "A minimum spanning tree",
      "Shortest paths by edge count",
      "Strongly connected components",
      "A topological order",
    ],
    answer: 1,
    explanation:
      "BFS explores in layers, so the first time a node is reached is via the fewest edges.",
  },
  {
    id: "ds4",
    subject: "Data Structures",
    topic: "Hashing",
    q: "Which technique resolves collisions by storing colliding keys in a linked list per bucket?",
    options: ["Linear probing", "Double hashing", "Separate chaining", "Rehashing"],
    answer: 2,
    explanation: "Separate chaining keeps a list at each bucket for all keys hashing there.",
  },
  {
    id: "ds5",
    subject: "Data Structures",
    topic: "Sorting Algorithms",
    q: "Which sorting algorithm has O(n log n) worst-case time and sorts in place?",
    options: ["Quick sort", "Merge sort", "Heap sort", "Insertion sort"],
    answer: 2,
    explanation:
      "Heap sort is O(n log n) in all cases with O(1) extra space; quick sort's worst case is O(n²).",
  },
  {
    id: "ds6",
    subject: "Data Structures",
    topic: "Arrays & Linked Lists",
    q: "Inserting at the head of a singly linked list takes…",
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    answer: 0,
    explanation: "You only create a node and repoint the head — constant time.",
  },
  {
    id: "m1",
    subject: "Engineering Mathematics",
    topic: "Laplace Transforms",
    q: "The Laplace transform of e^(at) is…",
    options: ["1/(s+a)", "1/(s−a)", "a/(s²+a²)", "s/(s²−a²)"],
    answer: 1,
    explanation: "∫₀^∞ e^(at)e^(−st) dt = 1/(s−a) for s > a.",
  },
  {
    id: "m2",
    subject: "Engineering Mathematics",
    topic: "Fourier Series",
    q: "For an even function on (−π, π), which Fourier coefficients vanish?",
    options: ["a₀", "aₙ", "bₙ", "None"],
    answer: 2,
    explanation:
      "bₙ involves ∫ f(x) sin(nx); the product of even and odd is odd, so it integrates to zero.",
  },
  {
    id: "m3",
    subject: "Engineering Mathematics",
    topic: "Vector Calculus",
    q: "The divergence of the curl of any smooth vector field is…",
    options: ["Zero", "One", "The Laplacian", "Undefined"],
    answer: 0,
    explanation: "∇·(∇×F) = 0 is a standard identity for twice-differentiable fields.",
  },
  {
    id: "m4",
    subject: "Engineering Mathematics",
    topic: "Complex Numbers",
    q: "The modulus of 3 + 4i is…",
    options: ["5", "7", "1", "25"],
    answer: 0,
    explanation: "|3+4i| = √(3² + 4²) = 5.",
  },
  {
    id: "m5",
    subject: "Engineering Mathematics",
    topic: "Differential Equations",
    q: "The general solution of y'' + y = 0 is…",
    options: ["Ae^x + Be^−x", "A cos x + B sin x", "(A + Bx)e^x", "Ax + B"],
    answer: 1,
    explanation: "The auxiliary equation m² + 1 = 0 gives m = ±i, leading to sines and cosines.",
  },
  {
    id: "os1",
    subject: "Operating Systems",
    topic: "Process Scheduling",
    q: "Which scheduling algorithm can cause starvation of long processes?",
    options: ["FCFS", "Round Robin", "Shortest Job First", "FIFO"],
    answer: 2,
    explanation:
      "SJF keeps picking short jobs; long jobs may wait indefinitely if short ones keep arriving.",
  },
  {
    id: "os2",
    subject: "Operating Systems",
    topic: "Deadlocks",
    q: "Which is NOT one of the Coffman conditions for deadlock?",
    options: ["Mutual exclusion", "Hold and wait", "Preemption", "Circular wait"],
    answer: 2,
    explanation: "The condition is NO preemption. Allowing preemption breaks deadlock.",
  },
  {
    id: "os3",
    subject: "Operating Systems",
    topic: "Memory Management",
    q: "Belady's anomaly can occur with which page-replacement algorithm?",
    options: ["LRU", "FIFO", "Optimal", "LFU"],
    answer: 1,
    explanation: "With FIFO, adding frames can sometimes increase page faults.",
  },
  {
    id: "os4",
    subject: "Operating Systems",
    topic: "Synchronization",
    q: "A semaphore initialised to 1 is commonly used as…",
    options: ["A counter", "A mutex lock", "A condition variable", "A pipe"],
    answer: 1,
    explanation: "A binary semaphore allows one process into the critical section at a time.",
  },
  {
    id: "os5",
    subject: "Operating Systems",
    topic: "File Systems",
    q: "An inode stores everything about a file EXCEPT…",
    options: ["Its size", "Its permissions", "Its name", "Block pointers"],
    answer: 2,
    explanation: "File names live in directory entries, which map names to inode numbers.",
  },
];

export const questionSubjects = Array.from(new Set(QUESTIONS.map((q) => q.subject)));
