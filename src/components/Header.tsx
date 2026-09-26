'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bars3Icon, SunIcon, MoonIcon, CalendarDaysIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface HeaderProps {
  onAddOrder: () => void;
  userEmail?: string;
  playFrame?: boolean;
  onOpenMenu?: () => void;
}

export function Header({ onAddOrder, userEmail, playFrame, onOpenMenu }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.assign('/login');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div
        className={`flex items-center justify-between gap-4 px-4 ${
          playFrame ? 'py-2.5' : 'container mx-auto py-4'
        }`}
      >
        <div className="flex items-center gap-2">
          {playFrame ? (
            <button
              type="button"
              onClick={onOpenMenu}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Atidaryti meniu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/" className="flex items-center">
              <Image
                src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
                alt="Piksel"
                width={200}
                height={64}
                className="h-12 w-auto dark:invert"
                priority
              />
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {userEmail && (
            <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400">
              {userEmail}
            </span>
          )}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Perjungti temą"
          >
            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onAddOrder}
            title="Pridėti užsakymą"
            aria-label="Pridėti užsakymą"
            className="p-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            <CalendarDaysIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            title="Atsijungti"
            aria-label="Atsijungti"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
