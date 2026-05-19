'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div
        className="w-full max-w-sm bg-[var(--surface)] border-2 border-[var(--lime)] rounded-md p-8 text-center"
        style={{ boxShadow: '6px 6px 0 var(--lime)' }}
      >
        <h1
          style={{ fontFamily: 'var(--font-dm-serif)' }}
          className="text-2xl font-normal text-[var(--black)] mb-4"
        >
          Check your email
        </h1>
        <p className="text-[var(--muted)] text-sm">
          We sent a confirmation link to <strong className="text-[var(--black)]">{email}</strong>.
          Click it to activate your account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-semibold text-[var(--black)] hover:underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    );
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
        Create your account
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
            minLength={6}
            autoComplete="new-password"
            className="auth-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-lime w-full justify-center"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-sm text-[var(--muted)]">
        Already have an account?{' '}
        <Link href="/login" className="text-[var(--black)] font-semibold hover:underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
