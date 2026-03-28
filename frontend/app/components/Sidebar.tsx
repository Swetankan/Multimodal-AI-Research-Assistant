"use client";

import { Bot, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react";
import { ModelProvider } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SidebarProps {
  provider: ModelProvider;
  model: string;
  models: string[];
  chunkSize: number;
  topK: number;
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onProviderChange: (value: ModelProvider) => void;
  onModelChange: (value: string) => void;
  onChunkSizeChange: (value: number) => void;
  onTopKChange: (value: number) => void;
}

export function Sidebar({
  provider,
  model,
  models,
  chunkSize,
  topK,
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
  onProviderChange,
  onModelChange,
  onChunkSizeChange,
  onTopKChange
}: SidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/55 backdrop-blur-sm transition lg:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-white/10 bg-[#0d1017]/92 backdrop-blur-xl transition-all duration-300 lg:static lg:z-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-[78px]" : "w-[280px]"
        )}
      >
        <div className={cn("flex items-center px-4 py-4", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed ? (
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Controls
              </div>
              <h2 className="mt-2 text-xl font-semibold text-white">Settings</h2>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 lg:inline-flex"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand controls" : "Collapse controls"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 lg:hidden"
              onClick={onClose}
              aria-label="Close controls"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isCollapsed ? (
          <div className="flex flex-1 flex-col items-center gap-4 px-3 pt-6">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent"
              onClick={onToggleCollapse}
              aria-label="Expand settings"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <div className="text-center text-[11px] leading-5 text-slate-500 [writing-mode:vertical-rl] [text-orientation:mixed]">
              research controls
            </div>
          </div>
        ) : (
          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-5">
            <p className="mb-5 text-sm leading-6 text-slate-400">
              Keep the focus on the conversation. OpenRouter is the default provider, and you can switch models any time.
            </p>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Bot className="h-4 w-4 text-accent" />
                  Provider
                </label>
                <select
                  value={provider}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/40"
                  onChange={(event) => onProviderChange(event.target.value as ModelProvider)}
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama</option>
                </select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <SlidersHorizontal className="h-4 w-4 text-accent" />
                  Model
                </label>
                <select
                  value={model}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/40"
                  onChange={(event) => onModelChange(event.target.value)}
                >
                  {models.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Chunk size</span>
                  <span className="font-[family-name:var(--font-mono)] text-accent">{chunkSize}</span>
                </div>
                <input
                  type="range"
                  min={300}
                  max={1200}
                  step={50}
                  value={chunkSize}
                  className="mt-4 w-full accent-[#9AE6B4]"
                  onChange={(event) => onChunkSizeChange(Number(event.target.value))}
                />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Top-k retrieval</span>
                  <span className="font-[family-name:var(--font-mono)] text-accent">{topK}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={topK}
                  className="mt-4 w-full accent-[#9AE6B4]"
                  onChange={(event) => onTopKChange(Number(event.target.value))}
                />
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}