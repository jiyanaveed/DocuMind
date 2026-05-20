'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, uploadFile } from '@/lib/api';
import type { CreateDocumentDto, Document } from '@repo/types';

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'done'; filename: string }
  | { status: 'error'; message: string };

export default function NewDocumentPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadState({ status: 'error', message: 'Only PDF, Word, and plain text files are supported.' });
      return;
    }

    setUploadState({ status: 'uploading', filename: file.name });
    try {
      const result = await uploadFile(file);
      setTitle(result.title);
      setContent(result.text);
      setUploadState({ status: 'done', filename: file.name });
    } catch (err) {
      setUploadState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to extract text',
      });
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const dto: CreateDocumentDto = {
      title,
      content,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      await apiRequest<Document>('/documents', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      router.push('/dashboard/documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1
        style={{ fontFamily: 'var(--font-dm-serif)' }}
        className="text-3xl font-normal text-[var(--black)] mb-6"
      >
        New Document
      </h1>

      {/* Upload area */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--black)]">Upload a file</span>
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="text-xs text-[var(--muted)] hover:text-[var(--black)] transition-colors underline underline-offset-2"
          >
            {showUpload ? 'or create manually' : 'or upload a file'}
          </button>
        </div>

        {showUpload && (
          <div>
            {uploadState.status === 'done' ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--lime)] border border-[var(--black)] rounded text-sm text-[var(--black)]" style={{ boxShadow: '3px 3px 0 var(--black)' }}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Text extracted from <strong className="mx-1">{uploadState.filename}</strong> — review and save below
                <button
                  type="button"
                  onClick={() => setUploadState({ status: 'idle' })}
                  className="ml-auto hover:opacity-60 transition-opacity"
                  aria-label="Clear"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 px-6 py-8 border-2 border-dashed rounded cursor-pointer transition-all ${
                  dragging
                    ? 'border-[var(--black)] bg-[var(--lime)] bg-opacity-20'
                    : 'border-[var(--border)] hover:border-[var(--black)] bg-[var(--surface)]'
                }`}
              >
                {uploadState.status === 'uploading' ? (
                  <>
                    <svg className="w-5 h-5 animate-spin text-[var(--black)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-sm text-[var(--muted)]">
                      Extracting text from <strong className="text-[var(--black)]">{uploadState.filename}</strong>…
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-8 h-8 text-[var(--muted2)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="text-sm text-[var(--muted)]">
                      Drop a file here, or{' '}
                      <span className="text-[var(--black)] font-semibold">click to browse</span>
                    </span>
                    <span
                      style={{ fontFamily: 'var(--font-dm-mono)' }}
                      className="text-xs text-[var(--muted2)]"
                    >
                      .pdf, .doc, .docx, .txt — max 10 MB
                    </span>
                    {uploadState.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">{uploadState.message}</p>
                    )}
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,text/plain"
                  className="sr-only"
                  onChange={handleInputChange}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <button type="submit" disabled={loading} className="btn-lime">
            {loading ? 'Creating…' : 'Create Document'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/documents')}
            className="btn-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
