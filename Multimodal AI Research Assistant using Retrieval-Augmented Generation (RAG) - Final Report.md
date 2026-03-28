# Multimodal AI Research Assistant using Retrieval-Augmented Generation (RAG)

Final-Year Capstone Project Technical Report

## 1. Abstract

The rapid growth of scientific literature has made it difficult for students, researchers, and practitioners to read, interpret, and compare research papers efficiently. Standard large language model interfaces provide fluent responses, but they frequently lack grounded evidence from uploaded research documents and therefore may produce answers that are incomplete, unverifiable, or hallucinated. This project addresses that problem by designing and implementing a Multimodal AI Research Assistant that combines a modern conversational interface with a Retrieval-Augmented Generation (RAG) backend for paper-aware question answering.

The proposed system allows a user to upload a PDF research paper, index its content, retrieve relevant chunks using dense and lexical similarity, and then generate grounded responses through external or local language models. The frontend is implemented using Next.js with a ChatGPT-like user experience, while the backend is implemented in FastAPI using sentence-transformer embeddings, FAISS-based retrieval, streamed model output, and source attribution. The platform also supports model selection, retrieval controls, markdown rendering, code block formatting, PDF context reset, and developer identity handling.

The result is a practical prototype that demonstrates how conversational AI, semantic retrieval, and document processing can be combined into a focused research workflow assistant. The project contributes both an end-to-end product implementation and a concrete study of tradeoffs in RAG system design, including chunking, retrieval quality, streaming UX, observability, evaluation, and deployment simplicity.

## 2. Introduction

The volume of academic publications is increasing at a rate that exceeds the reading capacity of most researchers. A typical literature review now involves scanning multiple papers, extracting problem formulations, comparing methods, identifying datasets and benchmarks, and locating limitations or future work sections. Even when a single paper is under consideration, manually finding precise evidence inside a long PDF can be time-consuming and cognitively expensive.

This challenge is particularly relevant for students in Computer Science and Data Analytics, where understanding recent papers is essential for coursework, capstone development, project design, experimentation, and viva preparation. Traditional search interfaces and static PDF viewers require repeated scrolling, keyword lookup, and manual note-taking. General-purpose chatbots reduce some reading effort, but their responses often rely on prior model knowledge rather than the actual uploaded document. As a result, users may receive confident but weakly grounded answers.

The motivation behind this project is therefore twofold. First, there is a clear need for an AI-based assistant that behaves like a research companion rather than a generic chatbot. Second, there is a need for a transparent and technically understandable system that demonstrates how retrieval and generation can be combined in a reliable workflow. This project aims to satisfy both needs by building a paper-aware conversational assistant that can ingest a PDF, retrieve evidence, stream answers, and present the source chunks used to support the response.

The system is designed not as a dashboard but as a conversation-first research workspace. By combining modern frontend interaction patterns with a focused RAG backend, the assistant helps users summarize papers, inspect methods, identify benchmark results, understand limitations, and ask follow-up questions in a natural dialogue.

## 3. Problem Statement

Research papers are difficult to consume efficiently because important information is distributed across long-form text, tables, and figures. Users often need precise answers to questions such as: What methodology is proposed? Which dataset was used? What benchmark improvement was reported? What limitations were acknowledged? Existing systems do not consistently solve this problem in a grounded, interactive, and user-friendly manner.

In formal terms, the problem addressed in this project is the design of an AI-assisted research interface that can accept a user’s query and an uploaded research paper, retrieve the most relevant sections of that document, and generate a grounded answer with visible evidence while preserving conversational usability.

Existing systems have several limitations. Static PDF readers offer no semantic question answering. Conventional search tools perform lexical lookup but do not synthesize answers. Generic LLM chat interfaces provide strong natural language output but may hallucinate or fail to cite paper-specific evidence. Some RAG systems exist, but many are either developer-oriented demos, lack product-level user experience, or require complex orchestration frameworks that are difficult to justify for a capstone-scale implementation.

The project therefore targets a practical gap: a clean, academically understandable, full-stack research assistant that balances usability, retrieval grounding, and implementation clarity.

## 4. Objectives

- To build a conversational research assistant that accepts natural language questions about uploaded papers.
- To implement a Retrieval-Augmented Generation pipeline that grounds responses in retrieved document evidence.
- To design a ChatGPT-like user interface with real-time streaming and a low-friction research workflow.
- To support PDF upload, text extraction, chunking, embedding, retrieval, and response generation in one integrated application.
- To expose retrieved chunks to the user for transparency and traceability.
- To allow model and retrieval controls such as provider selection, chunk size, and top-k retrieval depth.
- To maintain a system architecture that is technically rigorous but simple enough to explain clearly in a viva or project defense.
- To add basic testing and retrieval evaluation so that the system can be assessed beyond purely visual demonstration.

## 5. System Overview

The Multimodal AI Research Assistant is a full-stack application composed of a web-based conversational frontend and a Python-based backend. The frontend presents a dark, ChatGPT-style interface where the user uploads a PDF and asks questions in natural language. The backend processes the uploaded document, stores vector representations of its chunks, retrieves the most relevant evidence for a new query, and then calls a language model to generate a grounded response.

At a high level, the system works as follows. First, the user uploads a research paper in PDF format. The backend extracts the text, cleans and segments it into chunks, embeds those chunks into vector space, and stores them in FAISS. When a user asks a question, the backend converts the question into an embedding, retrieves the most relevant chunks using dense plus lexical scoring, constructs a grounded prompt, and forwards that prompt to either OpenRouter-hosted models or an optional Ollama-hosted local model. As the model generates an answer, the backend streams the output token-by-token to the frontend. The UI displays the answer progressively and exposes the retrieved source chunks in a collapsible evidence panel.

The system is therefore not merely a chatbot. It is a document-aware research assistant that combines interactive UX, retrieval infrastructure, configurable generation, and evidence presentation.

## 6. Complete Architecture

The architecture follows a modular client-server design. The frontend is implemented using Next.js App Router and Tailwind CSS. It is responsible for user interaction, message rendering, file upload, and streaming display. The backend is implemented in FastAPI and is responsible for PDF ingestion, chunking, embedding generation, vector search, prompt construction, and LLM communication.

Frontend layer: The primary UI container is the chat window. It manages local conversation state, handles PDF upload events, triggers chat requests, receives streamed events, and renders assistant replies with markdown and source panels. Supporting components include a sticky input bar, message bubbles, a collapsible settings sidebar, code block rendering, and animated thinking indicators.

Backend API layer: FastAPI exposes endpoints such as /upload, /chat, /reset, /retrieval/debug, and /retrieval/evaluate. These endpoints are intentionally narrow and map cleanly to system responsibilities. /upload performs ingestion. /chat performs retrieval and generation with streaming. /reset clears indexed memory. The retrieval endpoints support inspection and evaluation.

Document processing layer: After upload, the PDF is parsed using a PDF extraction utility. Extracted text is normalized and chunked with overlap. Chunking is important because large language models cannot consume full papers efficiently in one prompt, and retrieval works best when documents are segmented into semantically manageable units.

Embedding and retrieval layer: Each chunk is encoded with a sentence-transformer embedding model. Those embeddings are stored in a FAISS index for efficient similarity search. The implementation also includes lexical overlap scoring, so retrieval is not purely dense. This gives the system a lightweight hybrid behavior that improves practical performance on some queries.

Vector store layer: The current system stores embeddings and chunk metadata in a local FAISS index and JSON metadata file. This is a local persistence strategy suitable for a single-user capstone demonstration. It is not yet a multi-tenant or cloud-scale vector database.

LLM integration layer: The assistant supports two model paths. The default path uses OpenRouter, which provides access to hosted models such as GPT-4o mini. An optional local path uses Ollama for offline or self-hosted inference. This dual-provider design makes the system more flexible and also allows discussion of deployment tradeoffs in the capstone report.

Streaming layer: The backend returns newline-delimited JSON events representing thinking state, tokens, sources, and completion. The frontend reads this stream incrementally and updates the displayed assistant message in real time. This direct streaming architecture provides a more responsive user experience than waiting for a full response payload.

Observability layer: LangSmith tracing is integrated into the backend pipeline. Key phases such as PDF ingestion, retrieval, prompt construction, identity responses, generation, and fallback behavior can be traced. This makes the pipeline more auditable and easier to debug.

The interaction among components can therefore be summarized as: frontend request -> FastAPI endpoint -> PDF processing or retrieval pipeline -> model provider -> streamed response -> frontend rendering. Each layer is separated cleanly enough to support future extension and testing.

## 7. Working Flow (Step-by-Step)

The complete working flow of the assistant is described below in sequence.

1. The user opens the web application. The frontend displays a minimal greeting prompt and a sticky input composer.
2. The user optionally uploads a PDF using the inline plus button. The file is sent to the backend through the /upload endpoint.
3. The backend validates the uploaded file, temporarily stores it, extracts its text, and divides the text into overlapping chunks.
4. The chunked text is embedded using the sentence-transformer model. These vectors are then inserted into the FAISS index and the associated metadata is saved locally.
5. The frontend shows a status message indicating that the PDF is ready for analysis.
6. The user asks a question. The frontend packages the query, recent message history, provider choice, model choice, and retrieval parameters into a /chat request.
7. The backend first emits a thinking event. If the query is an identity query such as who created you, the system returns a controlled attribution response directly.
8. For a normal question, the backend searches the vector store, retrieves the most relevant chunks, and constructs a prompt that combines the user query, recent chat history, and retrieved context.
9. The prompt is sent to the configured model provider. The model response is streamed token-by-token back to the frontend.
10. The frontend appends the tokens incrementally, producing a live typing effect. While the answer is arriving, the tab title and UI state reflect a thinking or streaming condition.
11. Once generation completes, the backend emits the retrieved chunks as source metadata. The frontend renders these chunks inside a collapsible Sources section under the assistant response.
12. The user can continue the conversation, adjust retrieval parameters, clear the indexed PDF context, or start a new chat.

This stepwise pipeline ensures that every answer can be connected to a concrete retrieval path rather than being treated as an opaque model completion.

## 8. Features Implemented

- ChatGPT-like UI (Next.js): The interface is built as a full-screen, dark-themed chat workspace with centered content, message alignment by role, and product-style spacing. This makes the system feel like a modern conversational application rather than a classroom demo.
- Dynamic greeting system: On initial load, the application displays a rotating greeting that encourages the user to start a research-oriented conversation. This improves first-use clarity without adding visual clutter.
- Sticky input bar: The composer remains fixed at the bottom of the viewport, ensuring that users can always ask a follow-up question without losing context or scrolling excessively.
- Inline PDF upload (+ button): PDF ingestion is integrated directly into the input area using a plus-button interaction. This reduces workflow friction because the upload action is available at the same place where the user composes questions.
- Automatic PDF processing: Once a file is uploaded, the backend immediately extracts text, chunks the content, embeds the chunks, and updates the vector store without requiring a separate preprocessing step.
- Multi-turn chat system: The frontend stores chat history in React state and passes recent turns to the backend so that follow-up questions can be interpreted in context.
- Streaming responses: Assistant responses are streamed incrementally rather than returned as a single completed block. This improves perceived responsiveness and better matches modern LLM interaction patterns.
- Thinking indicator: Before the first token arrives, the interface displays a dedicated thinking state. This communicates that the system is processing retrieval and generation rather than failing silently.
- Markdown rendering: Assistant output supports headings, emphasis, lists, and other markdown structures. This is useful when the model returns summaries, enumerations, or structured explanations.
- Code block formatting with copy support: Fenced code blocks are rendered in styled containers with syntax highlighting and copy support. This feature is important for technical papers and code-oriented queries.
- Source attribution (retrieved chunks): Each assistant response can display the chunks that were retrieved from the uploaded paper. This increases transparency and supports academic trustworthiness.
- Sidebar controls (model, chunk size, top-k): Users can configure the LLM provider, specific model, chunk size, and retrieval depth. This makes the system useful not only as an end-user tool but also as an experimentation platform.
- Identity handling (developer attribution): The backend includes explicit logic so that identity questions always credit the application developers correctly, even if the answer also mentions external model providers.
- Error fallback handling: If the model provider is unavailable, the system attempts to provide a retrieval-only fallback rather than a complete failure. This keeps the application usable during partial outages and demonstrates graceful degradation.

## 9. Technology Stack

- Next.js: Chosen for its modern React-based architecture, component model, server-friendly structure, and strong support for App Router development. It enables a production-style frontend with clean routing and component composition.
- Tailwind CSS: Selected for rapid UI iteration, utility-first styling, and precise control over spacing, typography, responsiveness, and animation. It is especially useful for building a polished, custom conversational interface quickly.
- FastAPI: Chosen because it is lightweight, high-performance, Python-native, and well suited for JSON APIs and streaming responses. It integrates naturally with the rest of the machine learning and document-processing stack.
- FAISS: Used for efficient similarity search over embedded chunks. FAISS is a well-established library for vector indexing and provides very fast dense retrieval for a capstone-scale workload.
- Sentence Transformers: Selected because they provide strong off-the-shelf semantic embeddings for text retrieval tasks. The chosen model offers a good tradeoff between speed, memory usage, and retrieval quality.
- OpenRouter / Ollama: OpenRouter was chosen to access strong hosted models through a flexible provider interface. Ollama was retained as an optional path for local or offline experimentation. Supporting both makes the architecture adaptable and discussion-friendly in academic settings.
- LangSmith: Used for tracing and observability. It helps inspect how ingestion, retrieval, prompt construction, and generation behave across requests.
- pytest: Added for automated backend verification and regression prevention. This strengthens the engineering quality of the project and supports future modifications.

## 10. Design Decisions

- Custom RAG instead of LangChain: A custom pipeline was chosen because the current workflow is linear and well defined: ingest, chunk, embed, retrieve, prompt, stream, display. Introducing a heavy orchestration framework at the start would have increased abstraction and debugging cost without solving a genuinely complex control-flow problem. A custom design also makes the system easier to explain academically, because each stage is visible in the source code.
- In-memory vector store as an initial prototype choice: At the earliest design stage, an in-memory vector store was a reasonable starting point because it simplified implementation and enabled rapid iteration. As the project evolved, this was improved to local persisted FAISS storage. The design lesson is that early prototypes often trade persistence for simplicity, while later iterations selectively harden the components that create the most user-visible friction.
- Single PDF indexing: The system deliberately indexes one document context at a time. This simplifies mental load for the user, reduces ambiguity in retrieval, and avoids the complexity of multi-document metadata filtering during the first implementation stage. For a capstone, this decision kept the problem bounded and allowed deeper focus on interaction quality and retrieval grounding.
- Direct API streaming: The backend sends newline-delimited JSON events directly to the frontend rather than buffering the whole response. This decision improves perceived speed, supports animated thinking states, and aligns the user experience with current LLM products. It also keeps the streaming protocol explicit and easy to inspect.
- Dual-provider LLM integration: Supporting both OpenRouter and Ollama was a deliberate design choice. It reduces vendor lock-in, supports both cloud and local experimentation, and strengthens the educational value of the project by exposing deployment tradeoffs.
- Evidence-first response design: Source chunk display was treated as a core design requirement rather than an optional debugging feature. This reflects the fact that research assistance requires trust and traceability more than stylistic fluency alone.

## 11. Limitations

The system has several limitations that are important to acknowledge honestly.

- Single-document scope: The current assistant is still limited to one indexed PDF context at a time. This is appropriate for focused paper analysis but insufficient for large-scale literature review or cross-paper comparison.
- Local persistence rather than multi-user persistence: Although the vector store is persisted locally, it is not yet designed as a session-aware or multi-user database. The current pipeline state is effectively global to the running backend instance.
- Lightweight hybrid retrieval only: The retriever combines dense and lexical scoring, but it does not yet use a stronger reranker or a full hybrid search stack such as BM25 plus dense retrieval plus cross-encoder reranking.
- Evaluation metrics are still basic: The project now includes retrieval evaluation through term recall and hit rate, but this is not a complete answer-quality benchmark. It does not yet measure factuality, citation faithfulness, or end-to-end generation accuracy.
- PDF extraction quality issues: Some documents may contain duplicated text, ligature artifacts, or poorly extracted formatting. This can reduce retrieval precision and answer quality.
- No advanced multimodal parsing yet: Despite the project title and architecture direction, charts, figures, and tables are not yet deeply parsed as first-class structured knowledge objects. Most grounding is currently text-centric.
- Limited security and deployment hardening: The current implementation is suitable for local demonstration and academic evaluation, but it still requires improvements in authentication, secret handling, session isolation, and request limiting for production deployment.

## 12. Future Work

- Multi-document support: The assistant can be extended to index multiple papers simultaneously and support metadata-aware retrieval across a paper collection.
- Persistent vector database: A more robust vector database such as Chroma, Qdrant, Weaviate, or PostgreSQL with vector extensions could replace the current local persistence model.
- Hybrid search (BM25 + embeddings): A stronger hybrid stack can improve retrieval precision on lexical and method-specific queries.
- Reranking models: Adding a cross-encoder or reranker can improve the quality of the final retrieved chunk set, especially for nuanced questions such as limitations or ablations.
- Research paper comparison module: The assistant can be extended to compare methods, datasets, metrics, and contributions across multiple uploaded papers.
- Figure and table understanding: Future versions can parse tables and images more explicitly, allowing better handling of chart-based or benchmark-heavy documents.
- PPT generation: A useful extension would be automatic generation of presentation slides or viva summaries from a paper and chat history.
- Migration to LangGraph for advanced workflows: If the system evolves into a multi-step research agent with tools, web search, planning, and memory, LangGraph would become a more justified orchestration layer.
- Answer evaluation and benchmark datasets: Future work should include a stronger evaluation suite with ground-truth answer sets, retrieval precision at k, citation faithfulness, and user studies.
- Session and user isolation: Multi-user architecture with document namespaces and authenticated sessions would make the system safer and more scalable.

## 13. Conclusion

This project demonstrates that a practical AI research assistant can be built by combining modern frontend engineering with a focused Retrieval-Augmented Generation pipeline. The resulting system provides a user-friendly conversational interface for interacting with uploaded research papers, while grounding answers in retrieved document evidence and exposing those sources transparently.

From a technical perspective, the project integrates PDF processing, chunking, embeddings, vector retrieval, streamed generation, configurable model providers, source attribution, tracing, testing, and evaluation into a coherent full-stack application. From an academic perspective, it illustrates important engineering lessons about modular design, prompt construction, retrieval quality, observability, and the tradeoff between framework convenience and custom implementation clarity.

The project also offered substantial learning outcomes. It required understanding both frontend and backend development, retrieval system design, language model integration, asynchronous streaming, and software testing. Most importantly, it showed that reliable AI systems are not built by generation alone; they depend on careful retrieval, user experience design, transparency, and iterative refinement.

In summary, the Multimodal AI Research Assistant is a strong capstone outcome because it solves a real academic problem, demonstrates full-stack implementation skill, and provides a credible foundation for future research and product-level extension.

## 14. References

- Lewis, P., Perez, E., Piktus, A., et al. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS, 2020.
- Reimers, N., and Gurevych, I. Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks. EMNLP-IJCNLP, 2019.
- Johnson, J., Douze, M., and Jegou, H. Billion-scale similarity search with GPUs. IEEE Transactions on Big Data, 2019. FAISS is derived from this line of work.
- Vaswani, A., Shazeer, N., Parmar, N., et al. Attention Is All You Need. NeurIPS, 2017.
- FastAPI official documentation. https://fastapi.tiangolo.com/
- Next.js official documentation. https://nextjs.org/docs
- Tailwind CSS official documentation. https://tailwindcss.com/docs
- LangSmith documentation for tracing and observability. https://docs.smith.langchain.com/
