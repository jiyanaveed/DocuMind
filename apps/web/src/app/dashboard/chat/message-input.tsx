'use client';

import { useRef } from 'react';

interface Props {
  onSend: (text: string) => void;
  sending: boolean;
  disabled: boolean;
}

export default function MessageInput({ onSend, sending, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = ref.current?.value.trim();
    if (!text || sending || disabled) return;
    onSend(text);
    if (ref.current) ref.current.value = '';
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface2)] p-4">
      <div className="chat-input-wrap flex gap-0 items-end overflow-hidden">
        <textarea
          ref={ref}
          rows={1}
          placeholder="Ask a question about your documents… (Enter to send)"
          disabled={sending || disabled}
          onKeyDown={handleKeyDown}
          style={{ fontFamily: 'var(--font-syne)' }}
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-[var(--black)] placeholder:text-[var(--muted2)] focus:outline-none disabled:opacity-50 min-h-[46px] max-h-40 overflow-y-auto"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <button
          onClick={submit}
          disabled={sending || disabled}
          className="flex-shrink-0 m-1.5 px-4 py-2 bg-[var(--black)] text-white rounded text-sm font-medium flex items-center gap-2 hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
        >
          {sending ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span>Thinking…</span>
            </>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
