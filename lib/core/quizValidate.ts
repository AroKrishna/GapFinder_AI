import { normalizeForMatch, quoteSupported, resolveLabels } from "./citations";
import type { RetrievedChunk } from "./types";

export interface DraftQuestion {
  topic: string; // topic label, e.g. "T1"
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
  source_labels: string[];
  evidence_quote: string;
}

export interface ValidQuestion {
  topic_id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: 1 | 2 | 3;
  source_chunk_ids: string[];
  evidence_quote: string;
}

export interface Rejection {
  stem: string;
  reason: string;
}

/**
 * Deterministic gate between the model and the database. A question survives only if
 * it is well-formed AND its evidence quote is found in a passage it cites that was
 * actually retrieved for its topic.
 */
export function validateQuestions(
  drafts: DraftQuestion[],
  topicLabels: Map<string, string>, // "T1" -> topic uuid
  sourcesByTopic: Map<string, Map<string, RetrievedChunk>>, // topic uuid -> label map
): { valid: ValidQuestion[]; rejected: Rejection[] } {
  const valid: ValidQuestion[] = [];
  const rejected: Rejection[] = [];
  const seenStems = new Set<string>();

  for (const d of drafts) {
    const reject = (reason: string) => rejected.push({ stem: d.stem?.slice(0, 120) ?? "", reason });
    const topicId = topicLabels.get(d.topic?.trim().toUpperCase());
    if (!topicId) { reject("unknown topic"); continue; }
    const stem = d.stem?.trim() ?? "";
    if (stem.length < 10) { reject("stem too short"); continue; }
    const stemKey = normalizeForMatch(stem);
    if (seenStems.has(stemKey)) { reject("duplicate question"); continue; }

    const options = (d.options ?? []).map((o) => String(o).trim());
    if (options.length !== 4 || options.some((o) => !o)) { reject("needs exactly 4 non-empty options"); continue; }
    if (new Set(options.map(normalizeForMatch)).size !== 4) { reject("options are not distinct"); continue; }
    if (!Number.isInteger(d.correct_index) || d.correct_index < 0 || d.correct_index > 3) {
      reject("correct_index out of range"); continue;
    }
    if (!d.explanation?.trim()) { reject("missing explanation"); continue; }

    const sources = sourcesByTopic.get(topicId);
    const cited = sources ? resolveLabels(d.source_labels ?? [], sources) : [];
    if (!cited.length) { reject("cites no retrieved passage"); continue; }
    if (!cited.some((c) => quoteSupported(d.evidence_quote ?? "", c.content))) {
      reject("evidence quote not found in cited passage"); continue;
    }

    seenStems.add(stemKey);
    const diff = Math.round(Number(d.difficulty));
    valid.push({
      topic_id: topicId,
      stem,
      options,
      correct_index: d.correct_index,
      explanation: d.explanation.trim(),
      difficulty: (diff >= 1 && diff <= 3 ? diff : 2) as 1 | 2 | 3,
      source_chunk_ids: cited.map((c) => c.id),
      evidence_quote: d.evidence_quote.trim(),
    });
  }
  return { valid, rejected };
}
