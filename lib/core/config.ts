// Documented, tunable thresholds. Every number that shapes a diagnosis lives here.

export const INGEST = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPages: 60,
  maxChunksPerDoc: 250,
  chunkChars: 900,
  overlapChars: 150,
  minCharsPerPage: 40, // below this on average, treat the PDF as scanned
  embedBatch: 50,
  allowedMimes: ["application/pdf", "text/plain", "text/markdown"] as const,
};

export const RETRIEVAL = {
  topK: 6,
  maxContextChars: 7000,
  // Cosine similarity floor for gemini-embedding-001 @768d. Below it, the tutor
  // declines rather than answering from weak evidence.
  minSimilarity: 0.55,
};

export const QUIZ = {
  maxTopics: 6,
  questionsPerTopic: 2,
  chunksPerTopic: 4,
};

export const MASTERY = {
  /** Fewer graded questions than this → "not_assessed": not enough evidence. */
  minQuestions: 2,
  /** Fewer than this → estimate is shown as provisional. */
  provisionalBelow: 5,
  weakBelow: 0.5,
  strongAtOrAbove: 0.75,
  /** Evidence half-life: a response this many days old counts half as much. */
  halfLifeDays: 14,
  difficultyWeight: { 1: 0.8, 2: 1.0, 3: 1.2 } as Record<number, number>,
};

export const PLANNER = {
  horizonDays: 14,
  gapWeight: { weak: 3, not_assessed: 2.5, developing: 2, strong: 0.5 },
  declineBonus: 1,
};

export const RATE_LIMITS: Record<string, number> = {
  process: 30,
  topics: 10,
  quiz: 12,
  tutor: 40,
  sample: 5,
};
