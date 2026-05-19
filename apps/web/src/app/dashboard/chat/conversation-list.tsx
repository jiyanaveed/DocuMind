'use client';

import type { Conversation } from '@repo/types';

interface Props {
  conversations: Conversation[];
  activeConvId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  activeConvId,
  loading,
  onSelect,
  onNew,
}: Props) {
  return (
    <div className="hidden md:flex w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface2)] flex-col">
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={onNew}
          className="btn-lime w-full justify-center text-xs"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="space-y-1.5 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-[var(--border)] animate-pulse rounded" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p
            style={{ fontFamily: 'var(--font-dm-mono)' }}
            className="px-4 py-6 text-xs text-[var(--muted2)] text-center"
          >
            No conversations yet
          </p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-3 py-2.5 mx-1 rounded text-sm transition-colors ${
                activeConvId === conv.id
                  ? 'bg-[var(--lime)] text-[var(--black)] font-semibold'
                  : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--black)]'
              }`}
              style={{ width: 'calc(100% - 8px)' }}
            >
              <span className="block truncate">{conv.title || 'Untitled'}</span>
              <span
                style={{ fontFamily: 'var(--font-dm-mono)' }}
                className="block text-xs opacity-60 mt-0.5"
              >
                {new Date(conv.created_at).toLocaleDateString()}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
