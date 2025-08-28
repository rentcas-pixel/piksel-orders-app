'use client';


import { SunIcon, MoonIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onAddOrder: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ onAddOrder, isDarkMode, onToggleDarkMode }: HeaderProps) {

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center h-16 relative">
          {/* Logo in center */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="w-[90px] h-[90px] flex items-center justify-center">
              <img 
                src={isDarkMode ? "/Piksel-logo-black-2023.png" : "/Piksel-logo-black-2023.png"} 
                alt="Piksel Logo" 
                className={`w-full h-full object-contain ${isDarkMode ? 'brightness-0 invert' : ''}`}
              />
            </div>
          </div>

          {/* Actions on the right */}
          <div className="absolute right-4 flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              {isDarkMode ? (
                <SunIcon className="w-5 h-5" />
              ) : (
                <MoonIcon className="w-5 h-5" />
              )}
            </button>

            {/* Week Numbers Button */}
            <button
              onClick={onAddOrder}
              className="inline-flex items-center p-3 bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl"
              title="Savaičių numeriai"
            >
              <CalendarIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
