'use client';

import React, { useState } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface WeekNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WeekNumbersModal({ isOpen, onClose }: WeekNumbersModalProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState(new Date().getMonth());

  React.useEffect(() => {
    if (isOpen) {
      const currentMonthElement = document.getElementById(`month-${selectedMonth}`);
      if (currentMonthElement) {
        currentMonthElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isOpen, selectedMonth]);

  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getWeekNumber = (date: Date): number => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const getMondayOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getSundayOfWeek = (date: Date): Date => {
    const monday = getMondayOfWeek(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  };

  const getMonthName = (month: number): string => {
    const months = [
      'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
      'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
    ];
    return months[month];
  };

  const generateYearCalendar = (year: number) => {
    const calendar = [];
    const months = 12;
    
    for (let month = 0; month < months; month++) {
      const monthData = {
        month: month,
        monthName: getMonthName(month),
        weeks: [] as Array<{ week: number; monday: Date; sunday: Date; days: Array<{ date: Date; week: number }> }>
      };
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      
      let currentWeek = getWeekNumber(firstDay);
      let weekDays: Array<{ date: Date; week: number }> = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const week = getWeekNumber(date);
        
        if (week !== currentWeek && weekDays.length > 0) {
          const monday = getMondayOfWeek(weekDays[0].date);
          const sunday = getSundayOfWeek(weekDays[0].date);
          monthData.weeks.push({ week: currentWeek, monday, sunday, days: weekDays });
          weekDays = [];
          currentWeek = week;
        }
        
        weekDays.push({ date, week });
      }
      
      if (weekDays.length > 0) {
        const monday = getMondayOfWeek(weekDays[0].date);
        const sunday = getSundayOfWeek(weekDays[0].date);
        monthData.weeks.push({ week: currentWeek, monday, sunday, days: weekDays });
      }
      
      calendar.push(monthData);
    }
    
    return calendar;
  };

  const calendar = generateYearCalendar(selectedYear);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Savaičių numeriai {selectedYear}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedYear(prev => prev - 1)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(prev => prev + 1)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {calendar.map((monthData) => (
              <div 
                key={monthData.month} 
                id={`month-${monthData.month}`}
                className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 ${
                  monthData.month === selectedMonth ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 text-center">
                  {monthData.monthName}
                </h3>
                <div className="space-y-2">
                  {monthData.weeks.map((weekData, weekIndex) => (
                    <div key={weekIndex} className="bg-white dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Savaitė {weekData.week}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {weekData.monday.toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit' })} - {weekData.sunday.toLocaleDateString('lt-LT', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">P</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">A</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">T</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">K</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">P</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">Š</div>
                        <div className="text-center text-gray-500 dark:text-gray-400 font-medium">S</div>
                        {Array.from({ length: 7 }, (_, i) => {
                          const dayDate = new Date(weekData.monday);
                          dayDate.setDate(weekData.monday.getDate() + i);
                          const isCurrentMonth = dayDate.getMonth() === monthData.month;
                          return (
                            <div 
                              key={i} 
                              className={`text-center p-1 rounded ${
                                isCurrentMonth 
                                  ? 'text-gray-900 dark:text-gray-100' 
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            >
                              {dayDate.getDate()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
