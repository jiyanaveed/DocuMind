# DocuMind — Claude CLI Build Plan

> **How to use this file:**
> Run `claude` in your project root. At the start of each session paste the phase prompt below.
> Complete one phase fully before moving to the next.
> Supabase setup is done manually by you — skip to Phase 2 once your project and tables are ready.

---

## Context (read this before every phase)

**Project name: DocuMind**

**What we're building:** DocuMind — a full-stack AI-powered knowledge base. Users create/manage documents, then chat with an AI that retrieves relevant document chunks (RAG) to answer questions.

**Tech stack:**
- Monorepo: Turborepo + pnpm workspaces
- Frontend: Next.js 14 (app router) in `apps/web`
- Backend: NestJS in `apps/api`
- Database: Supabase (Postgres + pgvector) — set up manually
- AI: OpenAI SDK used as a universal adapter (works with OpenAI, Groq, Ollama, Together AI)
- Shared code: `packages/types` and `packages/ai-provider`

**Core principles to follow throughout:**
- Every DB query must scope to the authenticated `user_id` — never return another user's data
- The AI provider must be swappable via env vars with zero code changes
- Keep separation of concerns clean: controllers handle HTTP, services handle business logic
- Export all shared TypeScript types from `packages/types`
- Use `pnpm` as the package manager everywhere

---

## Phase 1 — Monorepo Scaffold

**Goal:** A working Turborepo monorepo where `pnpm install && turbo dev` spins up both apps.

Please do the following:

1. **Initialize the monorepo** at the current directory:
   - `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
   - Root `package.json` with `turbo` as a dev dependency and scripts: `dev`, `build`, `lint`
   - `turbo.json` with pipelines for `dev` (no cache, persistent), `build` (depends on upstream), and `lint`
   - `.gitignore` covering node_modules, .env files, .next, dist, turbo cache

2. **Create `apps/api`** — NestJS application:
   - Scaffold using NestJS CLI conventions (do not run interactive prompts — create files directly)
   - Dependencies: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@supabase/supabase-js`, `openai`, `pg`, `pgvector`, `reflect-metadata`, `rxjs`
   - Dev dependencies: `@nestjs/cli`, `@types/node`, `typescript`, `ts-node`, `@types/passport-jwt`
   - `tsconfig.json` with `experimentalDecorators` and `emitDecoratorMetadata` enabled
   - Entry point: `src/main.ts` bootstrapping on port 3001 with CORS enabled for `http://localhost:3000`
   - `AppModule` importing `ConfigModule.forRoot({ isGlobal: true })`
   - `package.json` scripts: `dev` runs `ts-node -r tsconfig-paths/register src/main.ts`, `build` runs `tsc`

3. **Create `apps/web`** — Next.js 14 application:
   - `package.json` with dependencies: `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `typescript`, `@types/react`, `@types/node`, `tailwindcss`, `autoprefixer`, `postcss`
   - `next.config.js` — minimal, no special config needed yet
   - `tsconfig.json` for Next.js with path alias `@/*` → `./src/*`
   - `tailwind.config.ts` and `postcss.config.js`
   - `src/app/layout.tsx` — root layout with basic HTML structure and Tailwind base styles
   - `src/app/page.tsx` — DocuMind landing page with "Welcome to DocuMind" heading and links to `/login` and `/dashboard`
   - `package.json` scripts: `dev` runs `next dev -p 3000`, `build` runs `next build`

4. **Create `packages/types`**:
   - `package.json` with name `@repo/types`, no runtime dependencies
   - `src/index.ts` exporting these interfaces:
     ```typescript
     export interface User { id: string; email: string; }
     export interface Document { id: string; user_id: string; title: string; content: string; tags: string[]; created_at: string; updated_at: string; }
     export interface DocChunk { id: string; document_id: string; content: string; chunk_index: number; embedding?: number[]; }
     export interface Conversation { id: string; user_id: string; title: string; created_at: string; }
     export interface Message { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; created_at: string; source_chunks?: DocChunk[]; }
     export interface CreateDocumentDto { title: string; content: string; tags?: string[]; }
     export interface UpdateDocumentDto { title?: string; content?: string; tags?: string[]; }
     export interface ChatMessageDto { conversation_id?: string; message: string; }
     export interface AIProviderConfig { provider: 'openai' | 'groq' | 'ollama' | 'together'; baseURL: string; apiKey: string; model: string; embeddingModel: string; }
     ```
   - `tsconfig.json` extending base, targeting ESNext

5. **Create `packages/ai-provider`**:
   - `package.json` with name `@repo/ai-provider`, dependency on `openai` and `@repo/types`
   - `src/index.ts` — placeholder that exports `AIProviderConfig` re-exported from `@repo/types`. Full implementation comes in Phase 6.

6. **Create `.env.example`** in the root:
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-jwt-secret

   # AI Provider (swap to change providers)
   AI_PROVIDER=openai
   AI_BASE_URL=https://api.openai.com/v1
   AI_API_KEY=sk-...
   AI_MODEL=gpt-4o-mini
   AI_EMBEDDING_MODEL=text-embedding-3-small

   # API
   API_PORT=3001
   ```

7. **Verify everything wires together:**
   - Each app's `package.json` should reference `@repo/types` as a workspace dependency: `"@repo/types": "workspace:*"`
   - Run `pnpm install` and confirm no errors
   - Confirm `turbo dev` would start both apps (don't need to actually run, just verify configs are correct)

**Done when:** `pnpm install` succeeds, both apps have valid entry points, shared types are importable.

---

## Phase 2 — Authentication

> **Before starting:** Ensure you have these env values ready (from your Supabase dashboard):
> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
> Copy `.env.example` to `apps/api/.env` and `apps/web/.env.local` and fill in the Supabase values.

**Goal:** Users can sign up and log in. All API routes are protected. The frontend redirects unauthenticated users to `/login`.

### NestJS side (`apps/api`):

1. **Create `src/supabase/supabase.module.ts`** — a global module that provides a `SupabaseClient` using the service role key (for server-side operations). Export it.

2. **Create `src/auth/jwt.strategy.ts`** — a Passport JWT strategy that:
   - Extracts the Bearer token from the `Authorization` header
   - Validates it against `SUPABASE_JWT_SECRET` using `passportjwt.Strategy`
   - Returns `{ userId: payload.sub, email: payload.email }` as the user object

3. **Create `src/auth/auth.guard.ts`** — a `JwtAuthGuard` extending `AuthGuard('jwt')` from `@nestjs/passport`.

4. **Create `src/auth/auth.module.ts`** — imports `PassportModule`, `JwtModule.registerAsync` (reading secret from `ConfigService`), registers the strategy, exports `JwtAuthGuard`.

5. **Update `AppModule`** to import `AuthModule` and `SupabaseModule`.

6. **Create a decorator `src/auth/current-user.decorator.ts`** — `@CurrentUser()` that extracts `req.user` from the request context.

### Next.js side (`apps/web`):

1. **Create `src/lib/supabase/client.ts`** — browser Supabase client using `createBrowserClient` from `@supabase/ssr`.

2. **Create `src/lib/supabase/server.ts`** — server Supabase client using `createServerClient` from `@supabase/ssr` (reads cookies from Next.js headers).

3. **Create `src/middleware.ts`** — Next.js middleware that:
   - Refreshes the Supabase session on every request
   - Redirects unauthenticated users hitting `/dashboard/*` to `/login`
   - Redirects authenticated users hitting `/login` or `/signup` to `/dashboard`

4. **Create `src/app/(auth)/login/page.tsx`** — login form with email + password fields. On submit, calls `supabase.auth.signInWithPassword()`. On success, redirects to `/dashboard`. Shows error message on failure.

5. **Create `src/app/(auth)/signup/page.tsx`** — signup form. Calls `supabase.auth.signUp()`. On success, shows "Check your email" message.

6. **Create `src/app/(auth)/layout.tsx`** — centered layout for auth pages.

7. **Create `src/app/dashboard/layout.tsx`** — dashboard shell layout with:
   - Top nav showing user email and a sign-out button
   - Sidebar with links: Documents (`/dashboard/documents`), Chat (`/dashboard/chat`)
   - Sign out calls `supabase.auth.signOut()` then redirects to `/login`

8. **Create `src/lib/api.ts`** — a typed fetch wrapper:
   ```typescript
   // Gets the current session token and attaches it as a Bearer header
   // Base URL reads from NEXT_PUBLIC_API_URL env var (default http://localhost:3001)
   export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T>
   ```

**Done when:** Visiting `/dashboard` without a session redirects to `/login`. After signing in, the dashboard layout renders with the user's email in the nav.

---

## Phase 3 — Document CRUD

**Goal:** Users can create, view, edit, and delete their own documents via both API and UI.

### NestJS side (`apps/api`):

1. **Create `src/documents/documents.module.ts`**, `documents.controller.ts`, `documents.service.ts`.

2. **`DocumentsService`** — inject `SupabaseClient` and implement:
   - `findAll(userId: string)` → `SELECT * FROM documents WHERE user_id = $1 ORDER BY updated_at DESC`
   - `findOne(id: string, userId: string)` → single document, throw `NotFoundException` if not found or not owned
   - `create(userId: string, dto: CreateDocumentDto)` → insert and return new document
   - `update(id: string, userId: string, dto: UpdateDocumentDto)` → update and return, throw if not found/owned
   - `remove(id: string, userId: string)` → delete, throw if not found/owned. Also delete associated `doc_chunks`.

3. **`DocumentsController`** with `@UseGuards(JwtAuthGuard)` on the class:
   - `GET /documents` → `findAll`
   - `GET /documents/:id` → `findOne`
   - `POST /documents` → `create`, then trigger embedding pipeline (call `EmbeddingsService.processDocument(doc)`)
   - `PATCH /documents/:id` → `update`, then re-trigger embedding pipeline
   - `DELETE /documents/:id` → `remove`
   - Use `@CurrentUser()` to get the userId in each handler

4. **Create `src/embeddings/embeddings.module.ts`** and `embeddings.service.ts` with a placeholder `processDocument(doc)` method that just logs for now — full implementation in Phase 5.

### Next.js side (`apps/web`):

1. **Create `src/app/dashboard/documents/page.tsx`** — document list page:
   - Server component that fetches `GET /documents` using the session token
   - Displays documents in a list/table with title, tags, updated date
   - "New Document" button linking to `/dashboard/documents/new`
   - Each document row links to `/dashboard/documents/[id]`

2. **Create `src/app/dashboard/documents/new/page.tsx`** — document creation page:
   - Client component with a form: Title input, Content textarea (large), Tags input (comma-separated → array on submit)
   - On submit, calls `POST /documents` via `apiRequest`
   - On success, redirects to `/dashboard/documents`

3. **Create `src/app/dashboard/documents/[id]/page.tsx`** — document detail/edit page:
   - Loads the document by id
   - Same form as creation, pre-filled with current values
   - "Save" button → `PATCH /documents/:id`
   - "Delete" button with confirmation → `DELETE /documents/:id` then redirect to list
   - Show document metadata (created/updated timestamps, tags)

4. **Add `NEXT_PUBLIC_API_URL=http://localhost:3001` to `apps/web/.env.local`.**

**Done when:** You can create a document from the UI, see it in the list, edit it, and delete it. The API correctly rejects requests without a valid JWT.

---

## Phase 4 — Supabase DB Utilities & pgvector Setup

> This phase ensures the NestJS backend can correctly talk to Postgres/pgvector for the RAG pipeline in Phase 5.

**Goal:** A working database service layer with pgvector query support.

### NestJS side (`apps/api`):

1. **Create `src/database/database.module.ts`** — a global module that provides a raw `pg.Pool` connection:
   - Reads `DATABASE_URL` from env (format: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`)
   - Registers the pgvector types using `pgvector/pg` so vectors serialize/deserialize correctly
   - Exports the pool as `PG_POOL` injection token

2. **Create `src/database/database.service.ts`** — wraps the pool with typed query helpers:
   ```typescript
   query<T>(sql: string, params?: unknown[]): Promise<T[]>
   queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
   ```

3. **Add `DATABASE_URL` to `.env`** (find this in Supabase dashboard → Settings → Database → Connection string → URI, use the "Transaction" mode URL).

4. **Update `AppModule`** to import `DatabaseModule`.

5. **Update `DocumentsService`** to use `DatabaseService` for raw queries instead of the Supabase JS client — this gives us access to pgvector operators (`<=>`) that the Supabase JS client doesn't support natively.

   Rewrite the service methods using parameterized SQL:
   ```sql
   -- findAll
   SELECT * FROM documents WHERE user_id = $1 ORDER BY updated_at DESC

   -- create
   INSERT INTO documents (user_id, title, content, tags) VALUES ($1,$2,$3,$4) RETURNING *

   -- update
   UPDATE documents SET title=$1, content=$2, tags=$3, updated_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING *

   -- remove
   DELETE FROM documents WHERE id=$1 AND user_id=$2
   DELETE FROM doc_chunks WHERE document_id=$1
   ```

**Done when:** All CRUD operations work via the pg pool. No regression in Phase 3 functionality.

---

## Phase 5 — RAG Pipeline (Embeddings + Retrieval)

**Goal:** Documents are chunked and embedded on save. The chat endpoint can retrieve relevant chunks via vector similarity search.

### `packages/ai-provider` — implement the full provider:

1. **`src/types.ts`** — export the `AIProvider` interface:
   ```typescript
   export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
   export interface ChatOptions { temperature?: number; maxTokens?: number; stream?: boolean; }
   export interface AIProvider {
     chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
     embed(text: string): Promise<number[]>;
   }
   ```

2. **`src/openai-provider.ts`** — implements `AIProvider` using the `openai` npm package:
   ```typescript
   // Constructor takes: baseURL, apiKey, model, embeddingModel
   // chat(): calls openai.chat.completions.create with the messages
   // embed(): calls openai.embeddings.create, returns the embedding array
   ```
   The `baseURL` is what makes this provider-agnostic — passing Groq's URL makes it use Groq.

3. **`src/factory.ts`** — `createAIProvider(config: AIProviderConfig): AIProvider`:
   - Always returns an `OpenAIProvider` instance
   - Sets `baseURL` based on `config.provider`:
     - `openai` → `https://api.openai.com/v1`
     - `groq` → `https://api.groq.com/openai/v1`
     - `ollama` → `http://localhost:11434/v1`
     - `together` → `https://api.together.xyz/v1`
   - Or uses `config.baseURL` directly if provided (override)

4. **`src/index.ts`** — re-export everything.

### NestJS — `EmbeddingsService` (`apps/api/src/embeddings/`):

1. **`EmbeddingsService`** — inject `ConfigService` and `DatabaseService`. On init, create the AI provider using env vars.

2. **Implement `processDocument(doc: Document)`:**
   ```
   Step 1 — Delete existing chunks:
     DELETE FROM doc_chunks WHERE document_id = $1

   Step 2 — Chunk the content:
     Split by paragraphs first (double newline), then if any chunk > 500 words
     split it further by sentences. Keep chunks between 100–500 words.
     Add 1-sentence overlap between adjacent chunks.

   Step 3 — Embed each chunk:
     For each chunk, call aiProvider.embed(chunk)
     This returns a number[] of 1536 dimensions (for OpenAI text-embedding-3-small)

   Step 4 — Insert into doc_chunks:
     INSERT INTO doc_chunks (document_id, content, chunk_index, embedding)
     VALUES ($1, $2, $3, $4::vector)
     (use pgvector's toSql() helper to format the vector)
   ```

3. **Implement `similaritySearch(query: string, userId: string, limit = 5)`:**
   ```sql
   SELECT dc.*, d.title as document_title,
          1 - (dc.embedding <=> $1::vector) as similarity
   FROM doc_chunks dc
   JOIN documents d ON d.id = dc.document_id
   WHERE d.user_id = $2
   ORDER BY dc.embedding <=> $1::vector
   LIMIT $3
   ```
   - First embed the query string with `aiProvider.embed(query)`
   - Pass the vector as the `$1` parameter

4. **Wire up:** In `DocumentsController`, after `create` and `update`, call `embeddingsService.processDocument(doc)` asynchronously (don't await — return the doc immediately, let embedding happen in background).

**Done when:** Creating a document triggers chunk + embed in the background. You can verify by checking the `doc_chunks` table in Supabase Studio — it should have rows with non-null `embedding` vectors.

---

## Phase 6 — AI Chat Interface

**Goal:** A working chat UI where users ask questions and get AI answers grounded in their documents.

### NestJS — Chat module (`apps/api/src/chat/`):

1. **`ChatModule`**, **`ChatController`**, **`ChatService`** — standard NestJS structure.

2. **`ChatService`** — inject `DatabaseService`, `EmbeddingsService`, `ConfigService`:

   **`createOrGetConversation(userId, conversationId?)`:**
   - If `conversationId` provided, verify it belongs to `userId`, return it
   - Otherwise insert a new conversation and return it

   **`sendMessage(userId, dto: ChatMessageDto)`:**
   ```
   1. Get/create conversation
   2. Save the user's message to the messages table
   3. Load recent conversation history (last 10 messages) from DB
   4. Run similaritySearch(dto.message, userId, 5)
   5. Build system prompt:
      "You are a helpful assistant. Answer the user's question using ONLY
       the context below. If the answer isn't in the context, say so.
       Cite which document each piece of information comes from.

       Context:
       [chunk1.document_title]: [chunk1.content]
       [chunk2.document_title]: [chunk2.content]
       ..."
   6. Call aiProvider.chat([systemMsg, ...history, userMsg])
   7. Save the assistant's response to messages table
   8. Return: { message: assistantMessage, source_chunks: retrievedChunks, conversation_id }
   ```

3. **`ChatController`** with `@UseGuards(JwtAuthGuard)`:
   - `POST /chat/message` → `sendMessage`
   - `GET /chat/conversations` → list user's conversations
   - `GET /chat/conversations/:id/messages` → load message history for a conversation

### Next.js — Chat UI (`apps/web/src/app/dashboard/chat/`):

1. **`page.tsx`** — chat page layout:
   - Left sidebar (240px): list of past conversations, "New Chat" button
   - Right main area: message thread + input box at bottom

2. **Conversation list** (client component):
   - Fetch `GET /chat/conversations` on load
   - Clicking a conversation loads its messages
   - "New Chat" clears the current conversation

3. **Message thread** (client component):
   - Renders messages in a scrollable list
   - User messages: right-aligned, dark background
   - Assistant messages: left-aligned, lighter background
   - Below each assistant message: collapsible "Sources" section showing which document chunks were used (title + snippet)
   - Auto-scrolls to bottom on new message

4. **Message input** (client component):
   - Textarea (Enter to send, Shift+Enter for newline)
   - Send button
   - Disabled + shows spinner while waiting for response
   - On send: POST to `/chat/message` with `{ message, conversation_id }`
   - Optimistically add the user message to the thread immediately

5. **Loading + error states:**
   - Show a skeleton loader while messages are loading
   - Show an error toast if the API call fails

**Done when:** You can open the chat page, type a question about one of your documents, and receive an AI response that references the relevant content. The Sources section shows which chunks were used.

---

## Phase 7 — Polish, Error Handling & README

**Goal:** Production-ready error handling, a clean developer experience, and complete documentation.

### NestJS:

1. **Global exception filter** (`src/filters/http-exception.filter.ts`):
   - Catches all exceptions
   - Returns consistent JSON: `{ statusCode, message, timestamp, path }`
   - Logs errors with context (no stack traces in production)

2. **Validation pipe** — add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `main.ts`.

3. **Add DTOs with class-validator decorators** for `CreateDocumentDto`, `UpdateDocumentDto`, `ChatMessageDto`.

4. **Health check endpoint** — `GET /health` returns `{ status: 'ok', timestamp }` — no auth required.

5. **Rate limiting consideration** — add a comment in `main.ts` explaining where you'd add `@nestjs/throttler` for production.

### Next.js:

1. **Loading states** — add `loading.tsx` files in document list and chat route segments.

2. **Error boundaries** — add `error.tsx` in dashboard routes that shows a friendly error message.

3. **Empty states** — when the documents list is empty, show a prompt: "No documents yet — create your first one to get started."

4. **Responsive layout** — ensure the sidebar collapses gracefully on narrow viewports.

### Root `README.md` — write a complete README covering:

**Sections:**
1. **Overview** — what DocuMind does, screenshot/description
2. **Tech stack** — list with brief reason for each choice
3. **Prerequisites** — Node 18+, pnpm, a Supabase project, an AI provider API key
4. **Setup instructions** (must work for a new developer):
   ```bash
   git clone <repo> documind
   cd documind  # or whatever you named the repo folder
   pnpm install
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env.local
   # Fill in env values
   turbo dev
   ```
5. **Supabase setup** — link to the SQL migrations file, explain enabling pgvector (`create extension vector`)
6. **How to swap AI providers** — show the 3 env var changes needed:
   ```bash
   # Switch to Groq
   AI_PROVIDER=groq
   AI_BASE_URL=https://api.groq.com/openai/v1
   AI_API_KEY=gsk_...
   AI_MODEL=llama3-8b-8192
   AI_EMBEDDING_MODEL=text-embedding-3-small  # Groq doesn't do embeddings, keep OpenAI for this

   # Switch to local Ollama
   AI_PROVIDER=ollama
   AI_BASE_URL=http://localhost:11434/v1
   AI_API_KEY=ollama
   AI_MODEL=llama3
   AI_EMBEDDING_MODEL=nomic-embed-text
   ```
7. **Architecture decisions** — explain: chunking strategy (why ~500 words with overlap), why single OpenAI SDK for all providers, RLS as the security model, why NestJS over Express
8. **What I'd improve given more time** — streaming responses, better chunking (semantic), document versioning, token usage tracking, evaluation framework for retrieval quality

### `supabase/migrations/001_initial.sql` — write the complete SQL:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Document chunks with vector embeddings
create table doc_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  content text not null,
  chunk_index integer not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'New conversation',
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  source_chunk_ids uuid[] default '{}',
  created_at timestamptz default now()
);

-- Indexes for performance
create index on doc_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on documents(user_id);
create index on conversations(user_id);
create index on messages(conversation_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger documents_updated_at before update on documents
  for each row execute function update_updated_at();

-- RLS policies
alter table documents enable row level security;
alter table doc_chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Documents: users see only their own
create policy "users own documents" on documents
  for all using (auth.uid() = user_id);

-- Doc chunks: visible if the parent document belongs to the user
create policy "users own doc chunks" on doc_chunks
  for all using (
    exists (select 1 from documents d where d.id = document_id and d.user_id = auth.uid())
  );

-- Conversations: users see only their own
create policy "users own conversations" on conversations
  for all using (auth.uid() = user_id);

-- Messages: visible if the conversation belongs to the user
create policy "users own messages" on messages
  for all using (
    exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
```

**Done when:** A brand new developer can clone the repo, follow the README, and have the app running locally.

---

## Stretch Goals (optional — do after Phase 7)

### Streaming AI responses

In `ChatService.sendMessage`:
- Return a `ReadableStream` instead of a string
- Use `openai.chat.completions.create({ stream: true })` and pipe the chunks

In `ChatController`:
- Return a `StreamableFile` or use SSE (`@Sse()` decorator from NestJS)

In the frontend:
- Use the Fetch API with `response.body.getReader()` to consume the stream
- Append each chunk to the message as it arrives

### Source citations

- The `sendMessage` response already returns `source_chunks`
- In the UI, render a "Sources" accordion below each assistant message
- Show: document title, a 2-sentence snippet, and a link to the full document

### File upload (PDF / TXT)

In NestJS:
- Add `POST /documents/upload` endpoint using `@UseInterceptors(FileInterceptor('file'))` from `@nestjs/platform-express`
- For `.txt` files: read as UTF-8 string
- For `.pdf` files: use `pdf-parse` npm package to extract text
- Then call the normal document create + embedding pipeline with the extracted text

In the frontend:
- Add a file input on the new document page
- If a file is selected, POST to `/documents/upload` with `multipart/form-data`
- Otherwise use the normal JSON create endpoint

### Token usage tracking

- Add a `token_usage` table: `(id, user_id, conversation_id, prompt_tokens, completion_tokens, model, created_at)`
- In `ChatService`, read `usage` from the OpenAI response and insert a row
- Add a `GET /usage` endpoint returning total tokens used (grouped by day or model)
- Add a simple usage page at `/dashboard/usage`

---

## Quick reference — file structure when complete

```
.
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── auth/          (jwt.strategy, auth.guard, current-user.decorator)
│   │       ├── supabase/      (supabase.module)
│   │       ├── database/      (database.module, database.service)
│   │       ├── documents/     (module, controller, service)
│   │       ├── embeddings/    (module, service)
│   │       ├── chat/          (module, controller, service)
│   │       └── filters/       (http-exception.filter)
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   ├── (auth)/    (login, signup)
│           │   └── dashboard/ (layout, documents/, chat/)
│           ├── lib/
│           │   ├── supabase/  (client.ts, server.ts)
│           │   └── api.ts
│           └── middleware.ts
├── packages/
│   ├── types/src/index.ts
│   └── ai-provider/src/      (types, openai-provider, factory, index)
├── supabase/migrations/001_initial.sql
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```
