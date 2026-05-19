'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div
      className="w-full max-w-sm bg-[var(--surface)] border-2 border-[var(--lime)] rounded-md p-8"
      style={{ boxShadow: '6px 6px 0 var(--lime)' }}
    >
      <h1
        style={{ fontFamily: 'var(--font-dm-serif)' }}
        className="text-2xl font-normal text-[var(--black)] mb-6"
      >
        Sign in to DocuMind
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--black)] mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="auth-input"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--black)] mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="auth-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-lime w-full justify-center"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[var(--black)] font-semibold hover:underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </div>
  );
}
