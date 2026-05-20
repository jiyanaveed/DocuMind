'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface UsageRow {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  model: string;
  date: string;
}

export default function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<UsageRow[]>('/usage')
      .then(setRows)
      .catch(() => setError('Failed to load usage data'))
      .finally(() => setLoading(false));
  }, []);

  const grandTotal = rows.reduce((sum, r) => sum + Number(r.total_tokens), 0);
  const totalRequests = rows.reduce((sum, r) => sum + Number(r.total_requests), 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-[var(--black)]" style={{ fontFamily: 'var(--font-syne)' }}>
        Token Usage
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Last 30 days of AI usage by day and model.</p>

      {loading && (
        <div className="mt-8 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[var(--border)] animate-pulse rounded" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-6 text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-8 text-sm text-[var(--muted2)]">
          No usage data yet. Start a chat to see token counts here.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4" style={{ boxShadow: '2px 2px 0 var(--lime)' }}>
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Total tokens</p>
              <p className="mt-1 text-2xl font-bold text-[var(--black)]" style={{ fontFamily: 'var(--font-syne)' }}>
                {grandTotal.toLocaleString()}
              </p>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Total requests</p>
              <p className="mt-1 text-2xl font-bold text-[var(--black)]" style={{ fontFamily: 'var(--font-syne)' }}>
                {totalRequests.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Date', 'Model', 'Requests', 'Prompt', 'Completion', 'Total'].map((h) => (
                    <th
                      key={h}
                      className="py-2 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                  >
                    <td className="py-2.5 px-3 text-[var(--black)]" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                      {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--muted)]" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                      {row.model}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--black)]">{Number(row.total_requests).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--muted)]">{Number(row.total_prompt_tokens).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--muted)]">{Number(row.total_completion_tokens).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-[var(--black)]">{Number(row.total_tokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
