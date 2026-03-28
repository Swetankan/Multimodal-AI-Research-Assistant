export type MessageRole = "user" | "assistant";
export type ModelProvider = "openrouter" | "ollama";

export interface SourceChunk {
  id: string;
  text: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: SourceChunk[];
  thinking?: boolean;
  streaming?: boolean;
}

export interface ChatRequest {
  query: string;
  provider: ModelProvider;
  model: string;
  top_k: number;
  history: Array<{
    role: MessageRole;
    content: string;
  }>;
}

interface StreamCallbacks {
  request: ChatRequest;
  signal?: AbortSignal;
  onThinking?: () => void;
  onToken: (token: string) => void;
  onSources?: (sources: SourceChunk[]) => void;
  onDone?: () => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function uploadPdf(file: File, chunkSize: number) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chunk_size", String(chunkSize));

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return response.json() as Promise<{
    filename: string;
    chunks_indexed: number;
    message: string;
  }>;
}

export async function clearMemory() {
  const response = await fetch(`${API_BASE_URL}/reset`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Unable to clear chat memory");
  }

  return response.json() as Promise<{
    message: string;
    vector_store: Record<string, unknown>;
  }>;
}

export async function streamChat({
  request,
  signal,
  onThinking,
  onToken,
  onSources,
  onDone
}: StreamCallbacks) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error("Unable to stream chat response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = JSON.parse(line) as
        | { type: "thinking" }
        | { type: "token"; token: string }
        | { type: "sources"; sources: SourceChunk[] }
        | { type: "done" };

      if (event.type === "thinking") {
        onThinking?.();
      }

      if (event.type === "token") {
        onToken(event.token);
      }

      if (event.type === "sources") {
        onSources?.(event.sources);
      }

      if (event.type === "done") {
        onDone?.();
      }
    }
  }
}