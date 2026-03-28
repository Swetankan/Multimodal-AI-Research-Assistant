"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Menu, PenSquare, Sparkles, Trash2, X } from "lucide-react";
import { ChatMessage, ModelProvider, clearMemory, streamChat, uploadPdf } from "@/lib/api";
import { InputBar } from "./InputBar";
import { MessageBubble } from "./MessageBubble";
import { Sidebar } from "./Sidebar";

const APP_TITLE = "Multimodal AI Research Assistant";
const THINKING_TITLE = "Thinking...";

const GREETINGS = [
  "What research question are we solving today?",
  "Ready to explore some papers?",
  "What would you like to analyze today?"
];

const DEFAULT_MODELS: Record<ModelProvider, string[]> = {
  openrouter: [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash-001",
    "meta-llama/llama-3.1-8b-instruct"
  ],
  ollama: ["llama3.1:8b", "mistral:7b", "phi4-mini", "qwen2.5:7b"]
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatProviderLabel(provider: ModelProvider) {
  return provider === "openrouter" ? "OpenRouter" : "Ollama";
}

function formatModelLabel(model: string) {
  if (model === "openai/gpt-4o-mini") {
    return "GPT-4o mini";
  }

  if (model === "anthropic/claude-3.5-sonnet") {
    return "Claude 3.5 Sonnet";
  }

  if (model === "google/gemini-2.0-flash-001") {
    return "Gemini 2.0 Flash";
  }

  if (model === "meta-llama/llama-3.1-8b-instruct") {
    return "Llama 3.1 8B";
  }

  return model;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isClearingPdf, setIsClearingPdf] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [provider, setProvider] = useState<ModelProvider>("openrouter");
  const [model, setModel] = useState(DEFAULT_MODELS.openrouter[0]);
  const [chunkSize, setChunkSize] = useState(700);
  const [topK, setTopK] = useState(4);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [greeting, setGreeting] = useState(GREETINGS[0]);

  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, []);

  useEffect(() => {
    document.title = isSending ? THINKING_TITLE : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [isSending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  const handleProviderChange = (nextProvider: ModelProvider) => {
    setProvider(nextProvider);
    setModel(DEFAULT_MODELS[nextProvider][0]);
  };

  const clearIndexedPdf = async ({ clearMessages }: { clearMessages: boolean }) => {
    await clearMemory();
    setActiveDocument(null);
    setUploadLabel(clearMessages ? "Chat memory cleared" : "PDF context cleared");
    if (clearMessages) {
      setMessages([]);
      setInput("");
    }
  };

  const handleReset = async () => {
    if (isResetting || isSending || isUploading || isClearingPdf) {
      return;
    }

    setIsResetting(true);
    try {
      await clearIndexedPdf({ clearMessages: true });
    } catch (error) {
      setUploadLabel(
        error instanceof Error ? error.message : "Unable to clear chat memory"
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleClearPdf = async () => {
    if (!activeDocument || isClearingPdf || isSending || isUploading || isResetting) {
      return;
    }

    setIsClearingPdf(true);
    try {
      await clearIndexedPdf({ clearMessages: false });
    } catch (error) {
      setUploadLabel(
        error instanceof Error ? error.message : "Unable to clear PDF context"
      );
    } finally {
      setIsClearingPdf(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed
    };

    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: "",
      thinking: true,
      streaming: false,
      sources: []
    };

    const history = messages.map((item) => ({
      role: item.role,
      content: item.content
    }));

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsSending(true);

    try {
      await streamChat({
        request: {
          query: trimmed,
          provider,
          model,
          top_k: topK,
          history
        },
        onThinking: () => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? { ...item, thinking: true, streaming: false }
                : item
            )
          );
        },
        onToken: (token) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    content: `${item.content}${token}`,
                    thinking: false,
                    streaming: true
                  }
                : item
            )
          );
        },
        onSources: (sources) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id ? { ...item, sources } : item
            )
          );
        },
        onDone: () => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? { ...item, thinking: false, streaming: false }
                : item
            )
          );
        }
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The backend did not return a valid response.";

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? {
                ...item,
                content: `I could not complete that request. ${message}`,
                thinking: false,
                streaming: false
              }
            : item
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (isSending || isResetting || isClearingPdf) {
      return;
    }

    setIsUploading(true);
    try {
      if (activeDocument && activeDocument !== file.name) {
        await clearIndexedPdf({ clearMessages: true });
        setUploadLabel("Previous PDF cleared for new upload");
      }

      await uploadPdf(file, chunkSize);
      setActiveDocument(file.name);
      setUploadLabel("PDF ready for analysis");
    } catch (error) {
      setUploadLabel(
        error instanceof Error ? error.message : "PDF upload failed"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const hasMessages = messages.length > 0;
  const modelBadge = `${formatModelLabel(model)} | ${formatProviderLabel(provider)}`;

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-white">
      <Sidebar
        provider={provider}
        model={model}
        models={DEFAULT_MODELS[provider]}
        chunkSize={chunkSize}
        topK={topK}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        onProviderChange={handleProviderChange}
        onModelChange={setModel}
        onChunkSizeChange={setChunkSize}
        onTopKChange={setTopK}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/8 bg-[#09090bf2] px-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open controls"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-100 sm:text-[15px]">
                {APP_TITLE}
              </div>
            </div>
          </div>

          <div className="ml-3 flex items-center gap-2">
            {activeDocument ? (
              <div className="hidden max-w-[240px] items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-200 sm:inline-flex sm:text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{activeDocument}</span>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-emerald-100 transition hover:bg-white/20"
                  onClick={handleClearPdf}
                  aria-label="Delete current document"
                  disabled={isClearingPdf || isSending || isUploading || isResetting}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
              onClick={handleReset}
              disabled={isResetting || isSending || isUploading || isClearingPdf}
            >
              <PenSquare className="h-3.5 w-3.5" />
              {isResetting ? "Clearing..." : "New chat"}
            </button>

            <button
              type="button"
              className="hidden h-8 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex sm:text-xs"
              onClick={handleClearPdf}
              disabled={!activeDocument || isClearingPdf || isSending || isUploading || isResetting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isClearingPdf ? "Removing..." : "Clear PDF"}
            </button>

            <div className="hidden max-w-[56vw] items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/70 sm:inline-flex sm:max-w-none sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">{modelBadge}</span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <section className="scrollbar-thin flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col pb-6 pt-4 sm:pb-8 sm:pt-6">
              <div
                className={[
                  "mx-auto flex w-full max-w-[720px] flex-col items-center justify-center text-center transition-all duration-500",
                  hasMessages
                    ? "pointer-events-none max-h-0 -translate-y-6 overflow-hidden opacity-0"
                    : "max-h-[320px] min-h-[28vh] translate-y-0 opacity-100 sm:max-h-[340px] sm:min-h-[34vh]"
                ].join(" ")}
              >
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {greeting}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:mt-5 sm:text-lg sm:leading-8">
                  Upload a PDF, tune retrieval, and stream grounded answers in a clean research conversation.
                </p>
              </div>

              <div className={hasMessages ? "pt-2" : "pt-8 sm:pt-10"}>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
              <div ref={bottomRef} />
            </div>
          </section>

          <InputBar
            value={input}
            onValueChange={setInput}
            onSend={() => sendMessage(input)}
            onUpload={handleUpload}
            isSending={isSending}
            isUploading={isUploading}
            uploadLabel={uploadLabel}
            hasMessages={hasMessages}
          />
        </div>
      </main>
    </div>
  );
}