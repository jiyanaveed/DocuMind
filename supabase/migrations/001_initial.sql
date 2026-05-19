-- DocuMind initial schema
-- Run this in Supabase Dashboard → SQL Editor before starting the app.

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- gen_random_uuid() fallback

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1536 dimensions = OpenAI text-embedding-3-small / text-embedding-ada-002
-- Change to 768 for Groq/nomic-embed-text, or 4096 for text-embedding-3-large
CREATE TABLE IF NOT EXISTS doc_chunks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  chunk_index  INTEGER     NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'New conversation',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_user_id       ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id  ON doc_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id   ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation   ON messages(conversation_id);

-- IVFFlat approximate nearest-neighbour index (cosine distance).
-- lists = ~sqrt(expected row count). Start at 10 for dev; raise for production.
-- Requires at least `lists` rows before it becomes faster than a seq scan.
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- Security model: the NestJS backend connects via the service-role key, which
-- bypasses RLS and manually scopes every query to the authenticated user_id.
-- These policies protect against direct Supabase API access (e.g. PostgREST).

ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

-- Documents: full ownership
CREATE POLICY "owner_all_documents" ON documents
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Chunks: scoped through parent document
CREATE POLICY "owner_read_chunks" ON doc_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM documents WHERE id = document_id AND user_id = auth.uid())
  );

-- Conversations: full ownership
CREATE POLICY "owner_all_conversations" ON conversations
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages: scoped through parent conversation
CREATE POLICY "owner_all_messages" ON messages
  USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
  );
