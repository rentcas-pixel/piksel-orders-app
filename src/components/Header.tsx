'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SunIcon, MoonIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onAddOrder: () => void;
}

export function Header({ onAddOrder }: HeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center">
          <Image
            src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
            alt="Piksel"
            width={200}
            height={64}
            className="h-12 w-auto dark:invert"
            priority
          />
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>
    </header>
  );
}
