'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  email: string;
}

export default function TopNav({ email }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-12 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-5 flex-shrink-0">
      <Link
        href="/dashboard"
        style={{ fontFamily: 'var(--font-dm-serif)' }}
        className="text-lg tracking-tight text-[var(--black)] hover:opacity-75 transition-opacity"
      >
        DocuMind
      </Link>
      <div className="flex items-center gap-4">
        <span
          style={{ fontFamily: 'var(--font-dm-mono)' }}
          className="text-xs text-[var(--muted)] hidden sm:block"
        >
          {email}
        </span>
        <button
          onClick={handleSignOut}
          className="text-xs text-[var(--muted)] hover:text-[var(--black)] transition-colors font-medium"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
