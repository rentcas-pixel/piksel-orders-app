'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function StaffLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError('Neteisingas el. paštas arba slaptažodis.');
        return;
      }

      const meResponse = await fetch('/api/app/me', { cache: 'no-store' });
      if (meResponse.status === 403) {
        const body = (await meResponse.json()) as { code?: string };
        if (body.code === 'agency_only') {
          window.location.assign('/piksel/agency');
          return;
        }
        await supabase.auth.signOut();
        setError('Ši paskyra neturi prieigos prie užsakymų sistemos.');
        return;
      }

      if (!meResponse.ok) {
        setError('Prisijungti nepavyko. Bandykite dar kartą.');
        return;
      }

      window.location.assign('/');
    } catch {
      setError('Prisijungti nepavyko. Bandykite dar kartą.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <Image
        src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
        alt="Piksel"
        width={200}
        height={64}
        className="h-12 w-auto dark:invert mb-8"
        priority
      />
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-6">
          Piksel užsakymų sistema
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              El. paštas
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slaptažodis
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Jungiamasi…' : 'Prisijungti'}
          </button>
        </form>
      </div>
    </div>
  );
}
