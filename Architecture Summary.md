**Architecture Summary**

This project is a full-stack “Multimodal AI Research Assistant” built as a chat-first web application. The frontend is a [Next.js App Router](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\page.tsx) application with a ChatGPT-style interface, while the backend is a [FastAPI](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\main.py) service that handles PDF ingestion, retrieval, and streamed answer generation.

On the frontend, the main chat shell lives in [ChatWindow.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\ChatWindow.tsx). It manages chat history in React state, sends user queries to the backend, streams assistant tokens gradually into the UI, and shows retrieved evidence under each assistant response. The input experience is implemented in [InputBar.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\InputBar.tsx), where the user can type prompts and upload PDFs from the same composer. Assistant responses are rendered with markdown and code formatting through [MessageBubble.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\MessageBubble.tsx), [MarkdownRenderer.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\MarkdownRenderer.tsx), and [CodeBlock.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\CodeBlock.tsx). Settings such as model provider, model choice, chunk size, and top-k retrieval are controlled through [Sidebar.tsx](C:\Users\sweta\OneDrive\Documents\capstone2draft2\frontend\app\components\Sidebar.tsx).

On the backend, [main.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\main.py) exposes two main endpoints: `POST /upload` and `POST /chat`. During upload, the PDF is parsed using [pdf_utils.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\pdf_utils.py), chunked into overlapping text segments, embedded using `sentence-transformers`, and indexed into FAISS through [vector_store.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\vector_store.py). During chat, [rag_pipeline.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\rag_pipeline.py) retrieves the most relevant chunks, builds a grounded prompt, sends it to OpenRouter by default or Ollama optionally, and streams tokens back to the frontend as newline-delimited JSON. LangSmith tracing is integrated in [rag_pipeline.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\rag_pipeline.py) to monitor ingestion, retrieval, prompt construction, generation, and fallback behavior.

The system is therefore organized as a clean pipeline: UI interaction -> REST request -> PDF processing and retrieval -> LLM generation -> token streaming back to UI. It is intentionally product-shaped rather than notebook-shaped, so the user experiences it as a real conversational research assistant.

**Why This RAG Design**

This RAG design is simple, direct, and appropriate for the current scope. The application is solving one primary problem: let the user upload a PDF and ask grounded questions about it in a conversational interface. For that use case, a lightweight custom pipeline is more efficient than introducing a heavy orchestration layer too early.

The design choices are pragmatic:
- `pypdf` is sufficient for extracting text from normal research PDFs.
- Manual chunking with overlap is easy to control and explain in a viva.
- `sentence-transformers/all-MiniLM-L6-v2` gives fast, local embedding generation with good retrieval quality for a student project.
- FAISS is fast, well known, and simple for top-k similarity search.
- OpenRouter gives access to strong hosted models without locking the system to one vendor.
- Direct streaming over FastAPI keeps the UX responsive and ChatGPT-like.

This architecture also has a strong academic advantage: every stage is visible and explainable. You can clearly describe how the document is transformed from raw PDF into chunks, embeddings, vectors, retrieved evidence, prompt context, and final answer. That traceability is much harder to explain if everything is hidden behind a higher-level chain abstraction.

The main tradeoff is that the current system is intentionally minimal:
- It stores only one in-memory FAISS index at a time.
- It does not persist multiple documents or sessions.
- It does not yet do advanced retrieval strategies such as reranking, metadata filtering, hybrid search, or query rewriting.
- It is not an agentic workflow; it is a focused retrieval-generation pipeline.

That tradeoff is acceptable because the system is solving a narrow problem well. For a capstone/demo, this is usually the right decision: build one retrieval pipeline cleanly, make it observable, and make the UX feel real.

**Migration Plan to LangChain/LangGraph**

If your faculty expects LangChain or LangGraph, the clean answer is not “rewrite everything,” but “wrap the current pipeline progressively.”

Phase 1: LangChain compatibility layer.
- Replace the custom embedding wrapper in [vector_store.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\vector_store.py) with a LangChain embeddings interface.
- Replace the manual prompt assembly in [rag_pipeline.py](C:\Users\sweta\OneDrive\Documents\capstone2draft2\backend\rag_pipeline.py) with a LangChain prompt template.
- Wrap the OpenRouter call in a LangChain chat model interface.
- Keep FastAPI, the current endpoints, and the frontend unchanged.

Phase 2: LangChain RAG pipeline.
- Convert the retriever into a LangChain retriever object.
- Build a retrieval chain that takes `query -> retrieve -> format context -> generate answer`.
- Preserve the current streamed response contract so the frontend still works as-is.
- Keep LangSmith tracing, now with LangChain-native traces.

Phase 3: LangGraph if agent workflows are required.
- Introduce a graph with nodes such as `identity_check`, `retrieve`, `answer`, `fallback`, and optionally `tool_use`.
- Add conditional edges:
  `identity_query -> direct attribution response`
  `normal_query -> retrieve -> generate`
  `provider_error -> fallback`
- If required later, add tools like web search, citation verification, or paper comparison as graph nodes.

Phase 4: Persistence and multi-document support.
- Move from in-memory FAISS to a persistent vector store.
- Add document/session state into LangGraph memory or external persistence.
- Support multiple uploaded PDFs, metadata filtering, and document-level citations.

So the recommended viva answer is:
- Current version is custom FastAPI RAG because it is simpler, transparent, and fits the problem.
- LangSmith is already integrated for observability.
- The system is migration-ready because the boundaries are already clean: ingestion, retrieval, prompt building, and generation are separated in dedicated modules.

If you want, I can convert this into:
1. a viva speech script
2. a PPT-ready architecture slide
3. examiner-style Q&A with model answers