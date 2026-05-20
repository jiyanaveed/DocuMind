CREATE TABLE token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON token_usage(user_id);
CREATE INDEX ON token_usage(created_at);

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own token usage" ON token_usage
  FOR ALL USING (auth.uid() = user_id);
