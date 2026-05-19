import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Document } from '@repo/types';
import DocumentEditForm from './document-edit-form';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchDocument(id: string, token: string): Promise<Document | null> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

type Props = { params: { id: string } };

export default async function DocumentPage({ params }: Props) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) notFound();

  const doc = await fetchDocument(params.id, session.access_token);
  if (!doc) notFound();

  return <DocumentEditForm document={doc} />;
}
