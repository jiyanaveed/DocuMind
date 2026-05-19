# DocuMind

An AI-powered knowledge base. Upload documents or write them manually, ask questions in a chat interface, and get answers grounded in your content with source citations.

## 1. Project Overview

DocuMind is a full-stack RAG (Retrieval-Augmented Generation) application. Documents you save are automatically chunked, embedded, and stored as vectors. When you ask a question in the chat interface, the system retrieves the most semantically relevant chunks, passes them as context to the LLM, and cites which documents the answer came from.

**Implemented features:**

- **Document CRUD** — create, edit, delete documents with title, content, and comma-separated tags
- **File upload** — upload `.pdf`, `.doc`, or `.docx` files; text is extracted server-side and pre-fills the editor
- **Automatic RAG pipeline** — documents are chunked and embedded on create/update; no manual indexing step
- **AI chat** — ask questions in natural language; the AI answers using only your documents as context
- **Source citations** — each AI response includes the specific chunks it drew from, with document titles
- **Persistent conversations** — conversation history is stored per-user; the last 10 messages are included as context on each turn
- **Multi-provider AI** — swap between OpenAI, Groq, Ollama, and Together AI by changing three env vars
- **Per-user isolation** — every query is scoped to the authenticated user; Supabase RLS adds a second layer
- **Supabase Auth** — email/password sign-up and sign-in; ES256 JWTs verified in NestJS via the JWKS endpoint

---

## 2. Tech Stack

| Layer | Technology | Why we chose it |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Shared packages (`@repo/types`, `@repo/ai-provider`) with a single install, parallel dev servers, and consistent lint/build pipelines |
| Frontend | Next.js 14 (App Router) | Server Components for data-fetching pages, Client Components for interactive chat and document editing |
| Backend | NestJS | Dependency injection, decorator-driven guards/pipes, and a module system that maps directly to domain boundaries |
| Database | Supabase (Postgres + pgvector) | Managed Postgres with built-in auth, Row Level Security, and the `vector` extension — no separate vector database |
| AI | OpenAI SDK (`openai` npm) — provider agnostic | All four supported providers expose an OpenAI-compatible API; one SDK, configurable `baseURL`, no branching |
| Styling | Tailwind CSS + custom CSS | Tailwind for layout and utilities; custom CSS classes (`.btn-lime`, `.doc-card`, `.dm-input`, etc.) for the design system |

---

## 3. Prerequisites

- **Node.js 20+** — v18 has known WebSocket issues with Supabase Realtime (not used here, but affects `@supabase/ssr` internals on some platforms)
- **pnpm 9+** — `npm install -g pnpm`
- A **Supabase project** with the `vector` extension enabled (free tier is fine) — [supabase.com](https://supabase.com)
- An **OpenAI API key** (or any OpenAI-spec compatible provider — see [§7](#7-how-to-swap-ai-providers))

---

## 4. Quick Start

```bash
git clone https://github.com/jiyanaveed/DocuMind.git documind
cd documind
pnpm install

cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
# Fill in the env values — see §6 for what each variable means

pnpm turbo dev
```

This starts both apps concurrently:

- **API** → `http://localhost:3001`
- **Web** → `http://localhost:3000`

To run them separately:

```bash
# Terminal 1
cd apps/api && pnpm dev

# Terminal 2
cd apps/web && pnpm dev
```

---

## 5. Supabase Setup

**1. Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard). Any region is fine; free tier is sufficient.

**2. Enable pgvector.** Go to **Database → Extensions**, search for `vector`, and enable it. Or run this in the SQL Editor:

```sql
create extension if not exists vector;
```

**3. Run the migration.** Open **SQL Editor**, paste the full contents of `supabase/migrations/001_initial.sql`, and click **Run**. This creates:

- `documents` — user-owned documents with title, content, and tags
- `doc_chunks` — chunked content with 1536-dimension embeddings (cosine similarity)
- `conversations` — per-user chat sessions
- `messages` — individual turns within a conversation
- IVFFlat approximate nearest-neighbour index on `doc_chunks.embedding`
- Row Level Security policies on all four tables

**4. Collect your env values** from **Project Settings → API**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`
- **JWT Secret** → `SUPABASE_JWT_SECRET`

And from **Project Settings → Database → Connection string → URI** (choose **Transaction mode**, port `6543`):

- → `DATABASE_URL`

> The `SUPABASE_JWT_SECRET` is included in the env but is **not used for JWT verification** in the NestJS API. The API validates tokens via the JWKS endpoint (ES256 asymmetric keys). The variable is kept in `.env.example` as a reference — see [§8](#8-architecture-decisions) for details.

---

## 6. Environment Variables

Both config files start from the same `.env.example`. The web app only needs the `NEXT_PUBLIC_*` variables and `NEXT_PUBLIC_API_URL`; all others belong in `apps/api/.env` only.

| Variable | Where to get it | Example | Required |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | `https://abcxyz.supabase.co` | Yes (both) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key | `eyJhbGci...` | Yes (both) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role secret | `eyJhbGci...` | Yes (API only) |
| `SUPABASE_JWT_SECRET` | Project Settings → API → JWT Secret | `super-secret-...` | Optional (not used for verification — kept for reference) |
| `DATABASE_URL` | Project Settings → Database → Connection string → URI (Transaction mode, port 6543) | `postgresql://postgres.ref:pass@aws-0-region.pooler.supabase.com:6543/postgres` | Yes (API only) |
| `AI_PROVIDER` | Your choice: `openai`, `groq`, `ollama`, `together` | `openai` | Yes (API only) |
| `AI_BASE_URL` | Provider's API base URL | `https://api.openai.com/v1` | Yes (API only) |
| `AI_API_KEY` | Your provider's API key | `sk-...` | Yes (API only) |
| `AI_MODEL` | Chat model name for your provider | `gpt-4o-mini` | Yes (API only) |
| `AI_EMBEDDING_MODEL` | Embedding model name for your provider | `text-embedding-3-small` | Yes (API only) |
| `API_PORT` | Port for the NestJS server | `3001` | No (defaults to 3001) |
| `NEXT_PUBLIC_API_URL` | URL the browser uses to reach the API | `http://localhost:3001` | Yes (both) |

---

## 7. How to Swap AI Providers

The AI abstraction in `packages/ai-provider` uses the `openai` npm package with a configurable `baseURL`. Groq, Together AI, and Ollama all expose OpenAI-compatible REST endpoints (`/v1/chat/completions`, `/v1/embeddings`), so the same SDK drives all of them — no provider-specific code, no extra dependencies.

Edit `apps/api/.env`:

**Default — OpenAI:**

```bash
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
```

**Switch to Groq** (fast inference, generous free tier):

```bash
AI_PROVIDER=groq
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL=llama3-8b-8192
AI_EMBEDDING_MODEL=text-embedding-3-small   # Groq doesn't host embeddings — keep OpenAI key for this
```

**Switch to Ollama** (fully local, no API key):

```bash
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3
AI_EMBEDDING_MODEL=nomic-embed-text
```

> `nomic-embed-text` produces 768-dimension vectors. If you switch to it, update `vector(1536)` → `vector(768)` in the migration and re-save all documents to regenerate embeddings — existing vectors are model-specific and incompatible.

**Switch to Together AI:**

```bash
AI_PROVIDER=together
AI_BASE_URL=https://api.together.xyz/v1
AI_API_KEY=...
AI_MODEL=meta-llama/Llama-3-8b-chat-hf
AI_EMBEDDING_MODEL=togethercomputer/m2-bert-80M-8k-retrieval
```

---

## 8. Architecture Decisions

### Monorepo with Turborepo

`@repo/types` defines the TypeScript interfaces (`Document`, `Message`, `Conversation`, `CreateDocumentDto`, etc.) that are shared between the NestJS backend and the Next.js frontend. Without a monorepo, these would either be duplicated or published as a separate npm package. Turborepo runs `pnpm turbo dev` to start both apps in parallel and handles build ordering (`"dependsOn": ["^build"]`) so `packages/types` and `packages/ai-provider` are compiled before the apps that consume them.

### Chunking Strategy

The chunking logic in `EmbeddingsService.chunkText()` splits content at paragraph and sentence boundaries, then accumulates sentences into chunks up to **500 words** (minimum 100 words) with **1-sentence overlap**.

- **Why not fixed token counts?** Sentence boundaries produce more semantically coherent chunks than arbitrary token splits. A sentence that spans a token-boundary chunk becomes incomplete and retrieves poorly.
- **Why not semantic chunking?** Running embeddings to find topic-shift boundaries would double the embedding cost for every save. Sentence-aware word-count chunking is a good cost/quality trade-off for general documents.
- **Why the 1-sentence overlap?** The last sentence of chunk N is repeated as the first sentence of chunk N+1. Facts that fall at a boundary appear in both chunks, so neither retrieval path loses context.
- **Short tail handling:** If the final chunk would be under 100 words, it's absorbed into the previous chunk rather than stored as a near-empty orphan that would score poorly in retrieval.

### RLS as Security Model

Every table has Row Level Security enabled and ownership policies applied. The NestJS API connects via the **service-role key**, which bypasses RLS — instead, every query includes an explicit `WHERE user_id = $N` parameter. This makes the security boundary explicit in application code.

RLS still matters as a **defence-in-depth** layer: if someone calls the Supabase REST API (PostgREST) directly with a user-scoped JWT, the policies still prevent cross-user data access — even if the application layer had a bug.

### Provider-Agnostic AI via OpenAI SDK

`packages/ai-provider` exports an `AIProvider` interface with two methods: `chat()` and `embed()`. `OpenAIProvider` implements it using the `openai` npm package, with `baseURL` injected at construction time. `createAIProvider()` in `factory.ts` maps the `AI_PROVIDER` env var to a base URL and returns an `OpenAIProvider` instance — one class, four providers.

This is different from a naive implementation that would branch on the provider name and instantiate different SDK clients. Adding a fifth provider (e.g. Anthropic's OpenAI-compatible endpoint) requires zero code changes — just new env values.

### NestJS over Express

NestJS brings: dependency injection (services injected into controllers make unit testing straightforward without manual wiring), a module system that creates clear domain boundaries (`DocumentsModule`, `ChatModule`, `EmbeddingsModule`, `UploadModule`), and guards/interceptors for cross-cutting concerns like auth (`JwtAuthGuard`) and global exception handling (`HttpExceptionFilter`). The structure scales without requiring convention discipline from every developer.

### ES256 JWT Verification

Supabase projects now issue **ES256 asymmetric JWTs** (not HS256). The token header contains `"alg": "ES256"` and a `kid` field referencing the signing key. A static HMAC secret cannot verify these tokens.

The `JwtStrategy` in `apps/api/src/auth/jwt.strategy.ts` uses `jwks-rsa@3` (`passportJwtSecret`) to fetch Supabase's public key from:

```
<SUPABASE_URL>/auth/v1/.well-known/jwks.json
```

The correct key is selected by `kid`, cached, and used to verify each request. This is more secure than a static secret because the private key never leaves Supabase's infrastructure.

> `jwks-rsa@4` depends on `jose@6` which is ESM-only and incompatible with the CommonJS ts-node setup used here. `jwks-rsa@3` uses `jose@4` (CommonJS) and has the same public API.

---

## 9. Project Structure

```
documind/
├── apps/
│   ├── api/                          # NestJS backend (port 3001)
│   │   └── src/
│   │       ├── auth/                 # JWT strategy, guard, current-user decorator
│   │       ├── chat/                 # Conversation and message endpoints + RAG logic
│   │       ├── database/             # pg.Pool wrapper (DatabaseService)
│   │       ├── documents/            # Document CRUD endpoints
│   │       ├── embeddings/           # Chunking, embedding, similarity search
│   │       ├── filters/              # Global HTTP exception filter
│   │       ├── health/               # GET /health
│   │       ├── supabase/             # Supabase admin client module
│   │       ├── upload/               # POST /upload — PDF and Word text extraction
│   │       └── app.module.ts         # Root module
│   └── web/                          # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── (auth)/           # Login and signup pages (black/zebra layout)
│           │   └── dashboard/
│           │       ├── chat/         # Chat interface, message thread, conversation list
│           │       ├── documents/    # Document list, new document, edit document
│           │       ├── layout.tsx    # Dashboard shell (auth check, TopNav, Sidebar)
│           │       ├── topnav.tsx    # Top navigation bar (client component)
│           │       └── sidebar.tsx   # Left sidebar with active-route highlighting
│           └── lib/
│               ├── api.ts            # apiRequest() and uploadFile() helpers
│               └── supabase/         # Browser and server Supabase clients
├── packages/
│   ├── types/                        # Shared TypeScript interfaces (Document, Message, DTOs, etc.)
│   └── ai-provider/                  # AIProvider interface, OpenAIProvider, createAIProvider factory
├── supabase/
│   └── migrations/
│       └── 001_initial.sql           # Tables, indexes, IVFFlat index, RLS policies
├── .env.example                      # Template for both apps/api/.env and apps/web/.env.local
├── package.json                      # Root scripts: dev, build, lint (via turbo)
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 10. API Endpoints

All endpoints except `GET /health` require a `Authorization: Bearer <supabase-access-token>` header.

**Documents**

| Method | Path | Description |
|---|---|---|
| `GET` | `/documents` | List the authenticated user's documents, newest first |
| `POST` | `/documents` | Create a document; triggers async embedding pipeline |
| `GET` | `/documents/:id` | Get a single document by ID |
| `PATCH` | `/documents/:id` | Update a document; re-embeds changed content |
| `DELETE` | `/documents/:id` | Delete a document and all its chunks |

**Upload**

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload a `.pdf`, `.doc`, or `.docx` file (multipart/form-data, field name `file`, max 10 MB); returns `{ title, text }` — text is not saved automatically, it pre-fills the editor |

**Chat**

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat/message` | Send a message; creates a conversation if none given; returns AI response + source chunks |
| `GET` | `/chat/conversations` | List all conversations for the authenticated user |
| `GET` | `/chat/conversations/:id/messages` | Get full message history for a conversation |

**System**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` — no auth required |

---

## 11. What I'd Improve Given More Time

- **Streaming AI responses** — use Server-Sent Events (`res.write()` / `EventSource`) so text appears token-by-token instead of waiting for the full response
- **Semantic chunking** — detect topic boundaries using embedding similarity rather than fixed word counts; would improve retrieval precision for long, multi-topic documents
- **Document versioning** — store a history of content changes and allow diffing or rollback
- **Token usage tracking** — log prompt and completion token counts per request; surface a usage dashboard per user
- **Retrieval evaluation** — add a test harness (e.g. RAGAS or a custom precision@k script) to measure whether the similarity search actually finds the right chunks
- **Rate limiting** — apply `@nestjs/throttler` per-user to prevent embedding pipeline abuse (each document save triggers N embedding API calls)
- **Embedding cache** — skip re-embedding chunks whose content is unchanged on document update (diff chunks before re-embedding)
- **E2E tests** — Playwright tests covering sign-up → create document → upload file → ask question → verify citation
- **CI/CD** — GitHub Actions pipeline: install → lint → type-check → build → deploy API to Railway, web to Vercel
- **Better error recovery in the embedding pipeline** — currently errors are logged but silently dropped; a retry queue (e.g. BullMQ) would make the pipeline reliable
- **More file types** — PPTX via `pptx2json`, CSV via `papaparse`, and web URLs via a headless fetch + HTML-to-text step

---

## 12. Loom Walkthroughs

- **App walkthrough:** [link]
- **AI-assisted development walkthrough:** [link]
