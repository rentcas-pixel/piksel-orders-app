'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { getClientAgencyPaths } from '@/lib/agency-portal-paths';

export default function AgencyLoginPage() {
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

      window.location.assign(getClientAgencyPaths().portal);
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
          Agentūrų portalas
        </h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="agency-email" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              El. paštas
            </label>
            <input
              id="agency-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <div>
            <label htmlFor="agency-password" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Slaptažodis
            </label>
            <input
              id="agency-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm"
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
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Jungiamasi…' : 'Prisijungti'}
          </button>
        </form>
      </div>
    </div>
  );
}
