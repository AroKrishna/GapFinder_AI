export type MasteryState = "weak" | "developing" | "strong" | "not_assessed";
export type TaskActivity = "read" | "practice" | "assess" | "tutor" | "review";

export interface PageText {
  page: number | null;
  text: string;
}

export interface Chunk {
  idx: number;
  content: string;
  page: number | null;
  heading: string | null;
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  document_title: string;
  content: string;
  page: number | null;
  heading: string | null;
  similarity: number;
  score: number;
}

export interface Citation {
  chunk_id: string;
  document_title: string;
  page: number | null;
  heading: string | null;
  excerpt: string;
}
