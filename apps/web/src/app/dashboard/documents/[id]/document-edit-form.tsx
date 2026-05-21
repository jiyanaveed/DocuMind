'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import type { Document, UpdateDocumentDto } from '@repo/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function DocumentEditForm({ document }: { document: Document }) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [tags, setTags] = useState(document.tags.join(', '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const dto: UpdateDocumentDto = {
      title,
      content,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      await apiRequest<Document>(`/documents/${document.id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      });
      router.push('/dashboard/documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;
    setDeleting(true);
    setError('');

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${API_BASE}/documents/${document.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.ok) {
        router.push('/dashboard/documents');
      } else {
        setError('Failed to delete document');
        setDeleting(false);
      }
    } catch {
      setError('Failed to delete document');
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1
        style={{ fontFamily: 'var(--font-dm-serif)' }}
        className="text-3xl font-normal text-[var(--black)] mb-1"
      >
        Edit Document
      </h1>
      <p
        style={{ fontFamily: 'var(--font-dm-mono)' }}
        className="text-xs text-[var(--muted2)] mb-6 space-x-3"
      >
        <span>Created {new Date(document.created_at).toLocaleString()}</span>
        <span>·</span>
        <span>Updated {new Date(document.updated_at).toLocaleString()}</span>
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-[var(--black)] mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="dm-input"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-[var(--black)] mb-1">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={16}
            className="dm-textarea"
          />
        </div>
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-[var(--black)] mb-1">
            Tags{' '}
            <span className="text-[var(--muted2)] font-normal">(comma-separated)</span>
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="engineering, design, research"
            className="dm-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-lime">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/dashboard/documents" className="btn-outline">
            Cancel
          </Link>
          <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  );
}
