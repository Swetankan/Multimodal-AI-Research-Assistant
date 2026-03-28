"use client";

import { ChangeEvent, KeyboardEvent, useRef } from "react";
import { ArrowUp, LoaderCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface InputBarProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onUpload: (file: File) => Promise<void>;
  isSending: boolean;
  isUploading: boolean;
  uploadLabel: string | null;
  hasMessages: boolean;
}

export function InputBar({
  value,
  onValueChange,
  onSend,
  onUpload,
  isSending,
  isUploading,
  uploadLabel,
  hasMessages
}: InputBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await onUpload(file);
    event.target.value = "";
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-4 lg:px-8">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2">
        {uploadLabel ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 shadow-bubble">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15">
              <Plus className="h-3 w-3" />
            </span>
            {uploadLabel}
          </div>
        ) : null}

        <div
          className={cn(
            "pointer-events-auto rounded-[28px] border border-white/10 bg-[#161616]/88 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all sm:rounded-[32px]",
            hasMessages ? "translate-y-0 opacity-100" : "animate-fade-in-up"
          )}
        >
          <div className="flex items-end gap-2 rounded-[24px] bg-black/10 px-2.5 py-2 sm:gap-3 sm:rounded-[26px] sm:px-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label="Upload PDF"
            >
              {isUploading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            <textarea
              rows={1}
              value={value}
              placeholder="Ask about a paper, compare methods, summarize findings..."
              className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[14px] leading-6 text-white outline-none placeholder:text-slate-500 sm:min-h-[48px] sm:py-2.5 sm:text-[15px] sm:leading-7"
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-[1.02] hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 sm:h-11 sm:w-11"
              onClick={onSend}
              disabled={!value.trim() || isSending}
              aria-label="Send message"
            >
              {isSending ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-500 sm:text-[11px]">
          Created with {"\u2764\uFE0F"} by Swetankan and his Team
        </p>
      </div>
    </div>
  );
}