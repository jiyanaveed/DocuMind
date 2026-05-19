'use client';

import { useEffect, useRef, useState } from 'react';

export interface SourceChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  document_title: string;
  similarity: number;
}

export interface UIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  source_chunks?: SourceChunk[];
}

interface Props {
  messages: UIMessage[];
  loading: boolean;
  typing?: boolean;
}

function SourcesSection({ chunks }: { chunks: SourceChunk[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 border-t border-[var(--border)] pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--muted2)] hover:text-[var(--muted)] flex items-center gap-1 transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>
          {chunks.length} source{chunks.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {chunks.map((chunk) => (
            <li key={chunk.id} className="bg-[var(--off-white)] border border-[var(--border)] rounded p-2.5 text-xs">
              <p
                style={{ fontFamily: 'var(--font-syne)' }}
                className="font-semibold text-[var(--black)] mb-1"
              >
                {chunk.document_title}
              </p>
              <p
                style={{ fontFamily: 'var(--font-dm-mono)' }}
                className="text-[var(--muted)] line-clamp-3"
              >
                {chunk.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[80, 60, 90].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div
            className="h-10 bg-[var(--border)] animate-pulse rounded-2xl"
            style={{ width: `${w}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default function MessageThread({ messages, loading, typing }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  if (loading) return <MessageSkeleton />;

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted2)] text-sm">
        Ask a question about your documents.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-[var(--black)] text-white rounded-br-sm'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--black)] rounded-bl-sm'
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            {msg.role === 'assistant' && msg.source_chunks && msg.source_chunks.length > 0 && (
              <SourcesSection chunks={msg.source_chunks} />
            )}
          </div>
        </div>
      ))}
      {typing && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
