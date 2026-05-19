# DocuMind

An AI-powered knowledge base. Upload your documents, ask questions about them in a chat interface, and get answers grounded in your content with source citations.

## Features

- **Document management** — create, edit, and delete markdown/text documents with tags
- **Automatic RAG pipeline** — documents are chunked and embedded on save; no manual indexing
- **AI chat** — ask questions in natural language; the AI retrieves the most relevant chunks and cites its sources
- **Multi-provider AI** — swap between OpenAI, Groq, Ollama, and Together AI by changing three env vars
- **Per-user isolation** — every DB query is scoped to the authenticated user; no data leakage between accounts
- **Auth** — Supabase email/password auth with JWT verification in NestJS

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Shared packages (`@repo/types`, `@repo/ai-provider`) with zero-config caching |
| Backend | NestJS | TypeScript-native, module/decorator architecture maps cleanly to service/controller separation |
| Frontend | Next.js 14 (App Router) | Server Components for data-fetching pages, Client Components for interactive chat |
| Database | Supabase (Postgres + pgvector) | Managed Postgres with built-in auth, Row Level Security, and the `vector` extension in one project |
| AI SDK | OpenAI SDK (`openai` npm) | Provider-agnostic via the `baseURL` parameter — one SDK, four providers, zero extra code |
| Auth | Supabase Auth + Passport JWT | Supabase issues JWTs; NestJS validates them with `passport-jwt` using the project's JWT secret |
| Validation | class-validator | Declarative DTO validation with whitelist stripping; prevents garbage reaching the service layer |

## Prerequisites

- **Node.js** 18 or later
- **pnpm** 9 or later (`npm install -g pnpm`)
- A **Supabase** project (free tier is fine) — [supabase.com](https://supabase.com)
- An **AI provider** API key (OpenAI, Groq, etc.) or a local Ollama instance

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> documind
cd documind
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

Open both files and fill in the values from your Supabase dashboard and AI provider:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role secret key |
| `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Secret |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → URI (**Transaction mode**, port 6543) |
| `AI_API_KEY` | Your OpenAI / Groq / Together API key |

> **Note:** `apps/web/.env.local` only needs the `NEXT_PUBLIC_*` variables and `NEXT_PUBLIC_API_URL`. The API variables (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `AI_*`) belong only in `apps/api/.env`.

### 3. Set up Supabase

#### Enable pgvector

In your Supabase dashboard → **Database** → **Extensions**, search for `vector` and enable it.

#### Run the migration

Open **SQL Editor** in your Supabase dashboard, paste the contents of `supabase/migrations/001_initial.sql`, and run it. This creates all four tables (`documents`, `doc_chunks`, `conversations`, `messages`), indexes, and Row Level Security policies.

### 4. Start development

```bash
turbo dev
```

This starts both apps concurrently:
- **API** → [http://localhost:3001](http://localhost:3001)
- **Web** → [http://localhost:3000](http://localhost:3000)

Visit [http://localhost:3000](http://localhost:3000), sign up, create a document, then open the Chat tab to ask questions about it.

---

## How to Swap AI Providers

Edit `apps/api/.env`. The `baseURL` in the factory overrides the default per-provider URL when set.

**Switch to Groq** (fast inference, free tier):
```bash
AI_PROVIDER=groq
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=gsk_...
AI_MODEL=llama3-8b-8192
AI_EMBEDDING_MODEL=text-embedding-3-small   # keep OpenAI for embeddings
```

**Switch to local Ollama** (fully offline):
```bash
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3
AI_EMBEDDING_MODEL=nomic-embed-text
```
> When switching embedding models, re-save all documents to regenerate embeddings — existing vectors are incompatible across models. Also update `vector(1536)` in the migration to match your model's dimension (e.g. `vector(768)` for nomic-embed-text).

**Switch to Together AI**:
```bash
AI_PROVIDER=together
AI_BASE_URL=https://api.together.xyz/v1
AI_API_KEY=<together-key>
AI_MODEL=meta-llama/Llama-3-8b-chat-hf
AI_EMBEDDING_MODEL=togethercomputer/m2-bert-80M-8k-retrieval
```

---

## Architecture Decisions

### Chunking strategy (~500 words, 1-sentence overlap)

Chunk size is a retrieval quality trade-off. Too small → a single chunk lacks context for the LLM. Too large → fewer distinct chunks are retrieved, and each costs more tokens. ~500 words (≈ 700 tokens) fits comfortably in the 8k context windows of most models while preserving enough context per chunk.

The 1-sentence overlap prevents the retrieval system from missing facts that fall exactly on a chunk boundary — the last sentence of chunk N is repeated as the first sentence of chunk N+1.

### Why the OpenAI SDK works for every provider

Groq, Together AI, and Ollama all expose an OpenAI-compatible REST API (`/v1/chat/completions`, `/v1/embeddings`). The `openai` npm package accepts a `baseURL` constructor option that redirects all calls to a different host. `createAIProvider()` in `packages/ai-provider` sets the correct `baseURL` per provider — no branching in application code.

### Security model: service role + manual user scoping

The NestJS API connects to Postgres using the Supabase **service-role** connection string, which bypasses Row Level Security. Instead of relying on RLS, every query explicitly includes `WHERE user_id = $N`. This makes the security boundary explicit in application code rather than hidden in database policy, and it works equally well whether the backend connects via the Supabase JS client or a raw `pg.Pool`.

RLS policies in `001_initial.sql` are still applied as a defence-in-depth layer against direct PostgREST / Supabase JS API access.

### NestJS over bare Express

NestJS adds: dependency injection (makes unit testing and swapping implementations easy), a module system that mirrors the domain boundaries (`DocumentsModule`, `ChatModule`, etc.), and decorator-driven validation (`class-validator`). The overhead is minimal and the structure scales well as new features are added. For a microservice or pure serverless target, bare Express or Hono would be a better fit.

---

## What I'd Improve Given More Time

| Area | Improvement |
|---|---|
| **Streaming** | Stream AI responses token-by-token with `res.write()` / SSE — eliminates the blank wait while the model thinks |
| **Semantic chunking** | Use sentence-transformer scores to split at topic boundaries instead of fixed word counts |
| **Document versioning** | Store a history of content changes; allow rollback and diff view |
| **Token tracking** | Log prompt/completion token counts per request; surface usage stats in the dashboard |
| **Retrieval evaluation** | Add a test harness (e.g. RAGAS) to measure precision/recall of the similarity search |
| **Embedding cache** | Skip re-embedding chunks whose content hasn't changed on document update |
| **Mobile UI** | Full responsive layout with a slide-in drawer for the chat conversation list |
| **Rate limiting** | Apply `@nestjs/throttler` per-user to prevent embedding pipeline abuse |
