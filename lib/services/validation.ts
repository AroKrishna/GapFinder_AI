import { z } from "zod";
import { INGEST } from "@/lib/core/config";

export const uuid = z.string().uuid();

export const workspaceInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  subject: z.string().trim().max(120).default(""),
  exam_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date must be YYYY-MM-DD")
    .nullish()
    .transform((v) => v || null),
  hours_per_day: z.coerce.number().min(0.5, "At least 0.5 hours").max(16),
});

export const documentInput = z.object({
  workspace_id: uuid,
  title: z.string().trim().min(1).max(200),
  filename: z.string().trim().min(1).max(200),
  mime: z.enum(INGEST.allowedMimes),
  size: z.number().int().positive().max(INGEST.maxFileBytes, "File exceeds the 10 MB limit"),
});

export const quizInput = z.object({ topic_ids: z.array(uuid).max(12).optional() });

export const submitInput = z.object({
  answers: z.array(z.object({ question_id: uuid, selected_index: z.number().int().min(0).max(3) })).min(1).max(50),
});

export const taskInput = z.object({ done: z.boolean() });

export const tutorInput = z.object({
  message: z.string().trim().min(2, "Ask a question").max(1000),
  topic_id: uuid.nullish(),
});

export const MAX_PROFILE_NAME_LENGTH = 100;

export function validateProfileName(rawName: unknown): { valid: boolean; error?: string; name: string } {
  if (typeof rawName !== "string") {
    return { valid: false, error: "Name must be text.", name: "" };
  }
  const name = rawName.trim();
  if (name.length === 0) {
    return { valid: false, error: "Full name cannot be empty.", name: "" };
  }
  if (name.length > MAX_PROFILE_NAME_LENGTH) {
    return {
      valid: false,
      error: `Full name cannot exceed ${MAX_PROFILE_NAME_LENGTH} characters.`,
      name,
    };
  }
  if (/[\u0000-\u001F\u007F]/.test(name)) {
    return { valid: false, error: "Name contains invalid characters.", name: "" };
  }
  return { valid: true, name };
}

export const profileInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Full name cannot be empty")
    .max(MAX_PROFILE_NAME_LENGTH, `Full name cannot exceed ${MAX_PROFILE_NAME_LENGTH} characters`),
});

export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-80);
  return cleaned || "file";
}
