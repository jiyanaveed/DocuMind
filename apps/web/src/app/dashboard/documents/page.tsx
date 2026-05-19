'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { Document } from '@repo/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiRequest<Document[]>('/documents')
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? documents.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : documents;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1
          style={{ fontFamily: 'var(--font-dm-serif)' }}
          className="text-3xl font-normal text-[var(--black)]"
        >
          Documents
        </h1>
        <Link href="/dashboard/documents/new" className="btn-lime">
          + New Document
        </Link>
      </div>

      {!loading && documents.length > 0 && (
        <div className="mb-5">
          <input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="dm-input max-w-xs"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-[var(--surface)] border border-[var(--border)] rounded-md animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="py-16 text-center text-[var(--muted)] text-sm">
          No documents match &ldquo;{search}&rdquo;
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 mb-4 rounded-full bg-[var(--surface)] border-2 border-[var(--border)] flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--muted2)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--black)] mb-2">No documents yet</h2>
          <p className="text-[var(--muted)] text-sm mb-6 max-w-xs">
            Create your first document — the AI can answer questions about anything you add.
          </p>
          <Link href="/dashboard/documents/new" className="btn-lime">
            Create your first document
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="doc-card block p-4">
              <div className="font-medium text-[var(--black)] leading-snug line-clamp-2 mb-2">
                {doc.title}
              </div>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{ fontFamily: 'var(--font-dm-mono)' }}
                      className="px-1.5 py-0.5 text-xs bg-[var(--off-white)] border border-[var(--border)] rounded text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div
                style={{ fontFamily: 'var(--font-dm-mono)' }}
                className="text-xs text-[var(--muted2)]"
              >
                {new Date(doc.updated_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
