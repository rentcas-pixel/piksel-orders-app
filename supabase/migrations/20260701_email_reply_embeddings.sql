-- Panašių išsiųstų atsakymų paieška (pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS email_reply_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL UNIQUE REFERENCES processed_emails(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  subject TEXT,
  reply_text TEXT NOT NULL,
  context_subject TEXT,
  to_addresses TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_reply_embeddings_sent_at_idx
  ON email_reply_embeddings (sent_at DESC);

CREATE INDEX IF NOT EXISTS email_reply_embeddings_hnsw_idx
  ON email_reply_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_similar_email_replies(
  query_embedding vector(1536),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  email_id uuid,
  subject text,
  reply_text text,
  context_subject text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.email_id,
    e.subject,
    e.reply_text,
    e.context_subject,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM email_reply_embeddings e
  ORDER BY e.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;
