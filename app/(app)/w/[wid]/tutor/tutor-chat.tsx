"use client";

import { AlertCircle, BookOpen, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CitationList } from "@/components/citation";
import { Markdown } from "@/components/markdown";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, EmptyState, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import type { Citation } from "@/lib/core/types";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  insufficient: boolean;
}

function suggestionsFor(topic: string | null) {
  return topic
    ? [
        `Explain ${topic} simply with key concepts`,
        `Give me a worked example of ${topic}`,
        `What common misconceptions arise with ${topic}?`,
        `Summarise the core takeaways of ${topic}`,
      ]
    : [
        "Summarise the main syllabus topics in my notes",
        "Explain the most complex concept in my material step by step",
        "Give me a practical example from my notes",
      ];
}

export function TutorChat({
  workspaceId,
  topics,
  initialTopic,
  initialMessages,
  hasMaterial,
}: {
  workspaceId: string;
  topics: { id: string; name: string }[];
  initialTopic: string | null;
  initialMessages: ChatMessage[];
  hasMaterial: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [topic, setTopic] = useState<string>(initialTopic ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const topicName = topics.find((t) => t.id === topic)?.name ?? null;

  // Explicit void return inside useEffect to prevent React cleanup errors
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);

    const tempUserId = crypto.randomUUID();
    setMessages((m) => [...m, { id: tempUserId, role: "user", content: message, citations: [], insufficient: false }]);

    try {
      const res = await api<{
        answer_markdown: string;
        citations: Citation[];
        insufficient_evidence: boolean;
        practice_question: string | null;
      }>(`/api/workspaces/${workspaceId}/tutor`, {
        body: { message, topic_id: topic || null },
      });

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.answer_markdown + (res.practice_question ? `\n\n**Practice question:** ${res.practice_question}` : ""),
          citations: res.citations ?? [],
          insufficient: res.insufficient_evidence,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The tutor could not generate an answer. Please try again.");
      // Rollback optimistic user message and restore input for easy retry
      setMessages((m) => m.filter((msg) => msg.id !== tempUserId));
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  if (!hasMaterial) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="Upload study materials first"
        description="The AI tutor is grounded exclusively in your own notes and syllabus documents. Upload notes in My Materials to start."
        action={<LinkButton href={`/w/${workspaceId}/documents`}>Go to My Materials</LinkButton>}
      />
    );
  }

  return (
    <Card className="flex h-[calc(100dvh-17rem)] min-h-[520px] flex-col overflow-hidden lg:h-[calc(100dvh-15rem)]">
      {/* Contextual filter bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-subtle/50 px-4 py-2.5">
        <label htmlFor="tutor-topic" className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Subject Topic
        </label>
        <select
          id="tutor-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="h-8 min-w-0 max-w-full rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none sm:w-auto"
        >
          <option value="">All uploaded study material</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="hidden text-xs text-faint sm:inline">
          Filtering to a specific topic yields focused answers from relevant sections.
        </span>
      </div>

      {/* Message history */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-bg/60 p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-10 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-base font-semibold text-ink">What concept would you like to review?</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Ask any question in plain language. Answers are retrieved directly from your indexed materials with citations.
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-brand px-4 py-2.5 text-sm font-normal text-white shadow-sm sm:max-w-[75%]">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-soft text-brand"
                aria-hidden
              >
                <Sparkles className="size-3.5" />
              </span>
              <div
                className={cn(
                  "min-w-0 max-w-[90%] rounded-xl rounded-tl-sm border bg-surface px-4 py-3 shadow-[var(--shadow-card)] sm:max-w-[82%]",
                  m.insufficient ? "border-[#FCE8BD]" : "border-border",
                )}
              >
                {m.insufficient && (
                  <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-md border border-[#FCE8BD] bg-[#FFF5DE] px-2 py-1 text-xs font-medium text-[#A66A0A]">
                    <AlertCircle className="size-3.5" aria-hidden /> Your uploaded material does not contain this information
                  </p>
                )}
                <Markdown text={m.content} />
                {m.citations.length > 0 && (
                  <div className="mt-3.5 border-t border-border pt-2.5">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Source passages from your notes
                    </div>
                    <CitationList citations={m.citations} numbered />
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 pl-10 text-xs text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin text-brand" aria-hidden /> Searching your notes and formulating grounded response…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions + Input form */}
      <div className="border-t border-border bg-surface p-3 sm:p-4">
        <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
          {suggestionsFor(topicName).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => send(s)}
              className="shrink-0 rounded-md border border-border bg-subtle/50 px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand-border hover:bg-brand-soft hover:text-brand disabled:opacity-50 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            maxLength={1000}
            placeholder={topicName ? `Ask about ${topicName}…` : "Ask a question about your study materials…"}
            aria-label="Your question"
            className="resize-none"
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0"
            disabled={busy || !input.trim()}
            aria-label="Send question to AI tutor"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
