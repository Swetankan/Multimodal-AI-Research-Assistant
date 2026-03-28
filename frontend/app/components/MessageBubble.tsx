"use client";

import { ChevronDown, FileText, Sparkles, User2 } from "lucide-react";
import { ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

function ThinkingIndicator() {
  return (
    <div className="flex min-h-[56px] items-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.2)]">
        <span
          className="animate-shimmer bg-[linear-gradient(90deg,rgba(148,163,184,0.52)_0%,rgba(148,163,184,0.72)_28%,rgba(255,255,255,0.98)_48%,rgba(16,163,127,0.94)_60%,rgba(148,163,184,0.7)_78%,rgba(148,163,184,0.52)_100%)] bg-[length:200%_100%] bg-clip-text text-base font-medium tracking-[0.01em] text-transparent"
        >
          Thinking
        </span>
        <span className="ml-0.5 inline-flex items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 animate-flicker rounded-full bg-thinkingGreen shadow-[0_0_10px_rgba(16,163,127,0.5)]"
              style={{ animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[1.1rem] w-[2px] animate-flicker rounded-full bg-white/90 align-[-0.15em] shadow-[0_0_10px_rgba(255,255,255,0.18)]"
    />
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "animate-fade-in-up mb-6 flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser ? (
        <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-bubble sm:flex">
          <Sparkles className="h-4 w-4" />
        </div>
      ) : null}

      <div className={cn("max-w-[92%] sm:max-w-[88%]", isUser && "order-first")}>
        <div
          className={cn(
            "rounded-[26px] px-5 py-4 shadow-bubble",
            isUser ? "bg-[#2a2b31] text-white" : "bg-transparent text-slate-100"
          )}
        >
          {message.thinking && !message.content ? (
            <ThinkingIndicator />
          ) : isUser ? (
            <p className="m-0 whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
              {message.content}
            </p>
          ) : (
            <div>
              <MarkdownRenderer content={message.content} />
              {message.streaming ? (
                <div className="mt-2 flex items-center">
                  <StreamingCursor />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!isUser && message.sources && message.sources.length > 0 ? (
          <details className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-slate-300 backdrop-blur">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Sources
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </summary>
            <div className="space-y-3 border-t border-white/10 px-4 py-4">
              {message.sources.map((source) => (
                <div key={source.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Relevance {source.score.toFixed(3)}
                  </div>
                  <p className="m-0 whitespace-pre-wrap leading-6 text-slate-300">
                    {source.text}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {isUser ? (
        <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-bubble sm:flex">
          <User2 className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}