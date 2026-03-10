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
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 relative">
        <div className="flex items-center justify-between h-24">
          {/* Spacer for balance */}
          <div className="w-12" />

          {/* Piksel logo - center */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center py-5">
            <Image
              src="/Piksel-Logotipas-juodas-RGB.jpg?v=2"
              alt="Piksel"
              width={240}
              height={80}
              className="h-14 w-auto dark:invert"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {isDarkMode ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>

            {/* Add Order Button */}
            <button
              onClick={onAddOrder}
              title="Pridėti užsakymą"
              className="p-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <CalendarDaysIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
