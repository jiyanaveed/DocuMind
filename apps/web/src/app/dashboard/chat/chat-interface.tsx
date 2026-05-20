'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, Message } from '@repo/types';
import { createClient } from '@/lib/supabase/client';
import { apiRequest } from '@/lib/api';
import ConversationList from './conversation-list';
import MessageThread, { type UIMessage, type SourceChunk } from './message-thread';
import MessageInput from './message-input';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ChatApiResponse {
  message: Message;
  source_chunks: SourceChunk[];
  conversation_id: string;
}

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[var(--black)] text-white px-4 py-3 rounded border border-[var(--lime)] text-sm max-w-sm" style={{ boxShadow: '3px 3px 0 var(--lime)' }}>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-[var(--muted2)] hover:text-white flex-shrink-0">✕</button>
    </div>
  );
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissError = useCallback(() => setError(null), []);
  // Keep a stable ref to activeConvId so async handlers always read the current value
  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;

  useEffect(() => {
    apiRequest<Conversation[]>('/chat/conversations')
      .then(setConversations)
      .catch(() => setError('Failed to load conversations'))
      .finally(() => setLoadingConversations(false));
  }, []);

  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMessages(true);
    apiRequest<Message[]>(`/chat/conversations/${activeConvId}/messages`)
      .then((msgs) =>
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            created_at: m.created_at,
          })),
        ),
      )
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoadingMessages(false));
  }, [activeConvId]);

  function handleNewChat() {
    setActiveConvId(null);
    setMessages([]);
  }

  function handleSelectConversation(id: string) {
    if (id === activeConvId) return;
    setActiveConvId(id);
    setMessages([]);
  }

  async function handleSend(inputText: string) {
    setSending(true);

    const userMsgId = `optimistic-${Date.now()}`;
    const streamingMsgId = `streaming-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        conversation_id: activeConvIdRef.current ?? '',
        role: 'user' as const,
        content: inputText,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${API_BASE}/chat/message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: inputText,
          conversation_id: activeConvIdRef.current ?? undefined,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Add empty assistant placeholder and switch to streaming mode
      setMessages((prev) => [
        ...prev,
        {
          id: streamingMsgId,
          conversation_id: activeConvIdRef.current ?? '',
          role: 'assistant' as const,
          content: '',
          created_at: new Date().toISOString(),
        },
      ]);
      setSending(false);
      setStreaming(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        const lines = decoded.split('\n\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (typeof data.content === 'string') {
            assistantContent += data.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId ? { ...m, content: assistantContent } : m,
              ),
            );
          }

          if (data.done === true) {
            const convId = typeof data.conversation_id === 'string' ? data.conversation_id : '';
            if (!activeConvIdRef.current && convId) {
              setActiveConvId(convId);
              apiRequest<Conversation[]>('/chat/conversations')
                .then(setConversations)
                .catch(() => {});
            }
            break outer;
          }

          if (typeof data.error === 'string') {
            throw new Error(data.error);
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== streamingMsgId));
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setSending(false);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex w-full h-full">
      <ConversationList
        conversations={conversations}
        activeConvId={activeConvId}
        loading={loadingConversations}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--off-white)]">
        {activeConvId === null && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted2)] text-sm gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--surface)] border-2 border-[var(--border)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--muted2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>Start a new chat or select a conversation.</p>
          </div>
        ) : (
          <MessageThread messages={messages} loading={loadingMessages} typing={sending} />
        )}
        <MessageInput onSend={handleSend} sending={sending || streaming} disabled={false} />
      </div>

      {error && <ErrorToast message={error} onDismiss={dismissError} />}
    </div>
  );
}
