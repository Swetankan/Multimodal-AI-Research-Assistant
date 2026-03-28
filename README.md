# Multimodal AI Research Assistant

A full-stack research assistant with a ChatGPT-style frontend and a FastAPI backend for PDF-grounded question answering using Retrieval-Augmented Generation (RAG).

## What It Does

The system lets a user:

- upload a research paper in PDF format
- ask natural-language questions about that paper
- retrieve relevant chunks from the indexed document
- generate grounded answers through an LLM provider
- view the retrieved source chunks used to support the answer

The current implementation is optimized for a strong single-user capstone demonstration and viva discussion.

## Report

Project report files generated for submission:

- `Multimodal AI Research Assistant using Retrieval-Augmented Generation (RAG) - Final Report.docx`
- `Multimodal AI Research Assistant using Retrieval-Augmented Generation (RAG) - Final Report.md`

## Tech Stack

Frontend:

- Next.js App Router
- React
- Tailwind CSS
- custom component-based chat UI
- markdown and code rendering support

Backend:

- FastAPI
- FAISS
- sentence-transformers
- httpx
- pypdf
- python-dotenv

LLM providers:

- OpenRouter by default
- Ollama optional

Observability and quality:

- LangSmith tracing
- pytest test suite
- retrieval accuracy check script

## Project Structure

```text
frontend/
  app/
    components/
    globals.css
    layout.tsx
    page.tsx
  lib/
backend/
  main.py
  pdf_utils.py
  rag_pipeline.py
  run_accuracy_check.py
  vector_store.py
  eval_cases.sample.json
  tests/
scripts/
package.json
README.md
```

## Features

- ChatGPT-like dark conversation UI
- dynamic greeting on first load
- sticky bottom input bar
- inline PDF upload from the composer
- streaming assistant responses
- thinking indicator and live streaming state
- markdown rendering
- styled code blocks with copy support
- collapsible source attribution section
- sidebar controls for provider, model, chunk size, and top-k
- identity handling for developer attribution
- reset controls for new chat and PDF clearing
- retrieval debug and retrieval evaluation endpoints
- backend test suite and retrieval accuracy runner

## Environment Files

Expected local environment files:

- `backend/.env`
- `frontend/.env.local`

Typical backend variables:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OLLAMA_BASE_URL=http://localhost:11434
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_langsmith_key_here
LANGSMITH_PROJECT=capstone2draft2
```

Frontend uses:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Setup

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
py -3.13 -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
```

Backend dependencies include:

- `fastapi==0.115.12`
- `uvicorn[standard]==0.34.0`
- `faiss-cpu==1.10.0`
- `sentence-transformers==3.4.1`
- `langsmith==0.1.147`
- `pytest==8.4.1`

## Development Run

Run the full stack from the project root:

```bash
npm run dev
```

The root launcher:

- starts frontend and backend together
- uses the backend virtual environment directly
- auto-selects the first free local frontend and backend ports from a safe range
- prints the actual URLs it chose

If ports such as `3000` or `8000` are already occupied, the launcher will move to the next free port automatically.

## Core API

### `GET /`

Returns healthcheck information and vector store metadata.

### `POST /upload`

Uploads a PDF, extracts text, chunks the content, embeds it, and updates the vector store.

Multipart fields:

- `file`: PDF file
- `chunk_size`: optional integer, defaults to `700`

### `POST /chat`

Accepts a user query, message history, provider, model, and top-k value, then streams newline-delimited JSON events.

Stream event types:

- `{"type":"thinking"}`
- `{"type":"token","token":"..."}`
- `{"type":"sources","sources":[...]}`
- `{"type":"done"}`

### `POST /reset`

Clears indexed PDF context and backend memory state.

### `POST /retrieval/debug`

Returns retrieved chunks and their scores for a given query.

### `POST /retrieval/evaluate`

Returns retrieval evaluation metrics such as:

- matched expected terms
- term recall
- hit status
- retrieved chunk payloads and scores

## Testing

Run the backend test suite:

```bash
cd backend
. .venv/Scripts/activate
pytest
```

Current automated coverage includes:

- FastAPI route tests with injected fake pipeline
- upload, reset, chat, and retrieval endpoint behavior
- retrieval evaluation logic
- PDF chunking utility behavior
- aggregate retrieval accuracy reporting

## Retrieval Accuracy Check

After uploading and indexing a PDF, run:

```bash
cd backend
. .venv/Scripts/activate
python run_accuracy_check.py --cases eval_cases.sample.json
```

This produces a report with:

- case count
- average term recall
- hit rate
- matched expected terms per case
- retrieved chunks and scores per case

You can also write the result to a file:

```bash
python run_accuracy_check.py --cases eval_cases.sample.json --output accuracy-report.json
```

## Current Design Notes

Important current design choices:

- custom RAG pipeline instead of LangChain orchestration
- local persisted FAISS storage
- one active PDF context at a time
- direct streaming from FastAPI to the frontend
- OpenRouter as default model provider with Ollama as fallback option

## Known Limitations

- single-PDF indexing only
- not multi-user or session-isolated
- retrieval evaluation is still basic and term-based
- no advanced reranker yet
- PDF extraction quality can affect retrieval precision
- not yet a full multimodal figure/table reasoning system
- security hardening is incomplete for production deployment

## Recommended Next Improvements

- multi-document support
- persistent multi-user document namespaces
- BM25 plus dense retrieval hybrid search
- reranking models
- answer-quality evaluation beyond retrieval recall
- richer figure and table understanding
- LangGraph-style advanced orchestration if the workflow becomes agentic

## Deployment

Recommended deployment split:

- Frontend: Vercel
- Backend: Render

This project is not a single-platform deployment because the frontend is a Next.js app and the backend is a standalone FastAPI service.

### 1. Push the repo to GitHub

Create the remote repository and push this project root.

### 2. Deploy the backend on Render

Official reference: https://render.com/docs/deploy-fastapi

This repo now includes `render.yaml`, so Render can import the backend service directly from the repository.

Backend service settings:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/`

Backend environment variables to set on Render:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_SITE_URL`
- `OPENROUTER_APP_NAME`
- `OLLAMA_BASE_URL` if you intend to use Ollama instead of OpenRouter
- `FRONTEND_ORIGINS`
- `LANGSMITH_TRACING`
- `LANGSMITH_ENDPOINT`
- `LANGSMITH_API_KEY`
- `LANGSMITH_PROJECT`

For `FRONTEND_ORIGINS`, use your Vercel production URL and any custom domain you add later.

### 3. Deploy the frontend on Vercel

Official references:

- https://vercel.com/docs/frameworks/full-stack/nextjs
- https://vercel.com/docs/git/vercel-for-github

When importing the GitHub repo into Vercel:

- Framework preset: Next.js
- Root directory: `frontend`
- Install command: `npm install`
- Build command: `npm run build`
- Output setting: default Next.js output

Frontend environment variables to set on Vercel:

- `NEXT_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com`

Vercel preview deployments will now work against the deployed backend as long as the backend allows that frontend origin.

### 4. Update backend site URL for OpenRouter

Once the frontend is live, update the backend environment variable:

- `OPENROUTER_SITE_URL=https://your-vercel-frontend.vercel.app`

This keeps provider metadata aligned with the deployed frontend.

### 5. Preview mode behavior

- Vercel automatically creates preview deployments for branches and pull requests connected through GitHub.
- Render runs the backend as a hosted API service; your Vercel preview frontend can call that shared backend.

## Deployment Notes

- Backend CORS now allows local networks and `*.vercel.app` preview domains.
- Local vector storage is ignored by git and should not be committed.
- Secrets must never be committed; keep using `backend/.env` only for local development and set production secrets in the hosting dashboards.