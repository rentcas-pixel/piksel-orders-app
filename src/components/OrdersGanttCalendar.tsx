'use client';

import { useMemo, useState } from 'react';
import { addMonths, subMonths, getISOWeek } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Order } from '@/types';
import { parseDateOnlyLocal, formatDateInputValue } from '@/lib/date-utils';

const WEEKDAYS = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

function isOrderActiveOnDay(order: Order, day: Date): boolean {
  const from = parseDateOnlyLocal(order.from);
  const to = parseDateOnlyLocal(order.to);
  if (!from || !to) return false;
  const time = day.getTime();
  return from.getTime() <= time && time <= to.getTime();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function orderTooltipLabel(order: Order): string {
  return `${order.client} (${formatDateInputValue(order.from)} – ${formatDateInputValue(order.to)})`;
}

function dayCellBackground(isToday: boolean, weekend: boolean, active: boolean): string {
  if (active) return '';
  if (isToday) return 'bg-gray-100/80 dark:bg-gray-800/55';
  if (weekend) return 'bg-gray-50/35 dark:bg-gray-900/15';
  return 'bg-gray-50/20 dark:bg-gray-900/10';
}

function approvedBarClass(isToday: boolean): string {
  return isToday
    ? 'bg-gray-600/75 dark:bg-gray-500/70'
    : 'bg-gray-400/45 dark:bg-gray-500/40';
}

export interface OrdersGanttCalendarProps {
  orders: Order[];
  loading: boolean;
  viewDate: Date;
  onViewDateChange: (date: Date) => void;
  onOrderClick: (order: Order) => void;
  orderSubline?: (order: Order) => string;
  emptyMessage?: string;
}

export function OrdersGanttCalendar({
  orders,
  loading,
  viewDate,
  onViewDateChange,
  onOrderClick,
  orderSubline,
  emptyMessage = 'Šį mėnesį kampanijų nerasta.',
}: OrdersGanttCalendarProps) {
  const [hoveredOrder, setHoveredOrder] = useState<Order | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = useMemo(() => new Date(), []);

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1)),
    [daysInMonth, year, month]
  );

  const monthLabel = viewDate.toLocaleDateString('lt-LT', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {hoveredOrder && (
        <div
          className="fixed z-50 pointer-events-none max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-gray-700"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
        >
          {orderTooltipLabel(hoveredOrder)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewDateChange(subMonths(viewDate, 1))}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Ankstesnis mėnuo"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize min-w-[10rem] text-center">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => onViewDateChange(addMonths(viewDate, 1))}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Kitas mėnuo"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onViewDateChange(new Date())}
            className="ml-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Šiandien
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-600/75 dark:bg-gray-500/70" />
            Patvirtinta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-300/55" />
            Nepatvirtinta
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400">Kraunama…</div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[48rem]">
            <div
              className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
              style={{
                gridTemplateColumns: `minmax(11rem, 14rem) repeat(${daysInMonth}, minmax(1.75rem, 1fr))`,
              }}
            >
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-gray-50 dark:bg-gray-900/50">
                Kampanija
              </div>
              {days.map((day, dayIndex) => {
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                const isToday = isSameCalendarDay(day, today);
                const weekNumber = getISOWeek(day);
                const showWeekLabel =
                  dayIndex === 0 || getISOWeek(days[dayIndex - 1]) !== weekNumber;
                return (
                  <div
                    key={day.toISOString()}
                    className={`py-1 text-center text-[10px] leading-tight border-r border-gray-100 dark:border-gray-700/80 ${
                      weekend && !isToday
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-600 dark:text-gray-400'
                    } ${isToday ? 'bg-gray-100/80 dark:bg-gray-800/55' : 'bg-gray-50/25 dark:bg-gray-900/10'}`}
                  >
                    <div
                      className={`mb-0.5 text-[9px] font-semibold tracking-tight ${
                        showWeekLabel
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-transparent select-none'
                      }`}
                    >
                      W{weekNumber}
                    </div>
                    {isToday ? (
                      <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                        {day.getDate()}
                      </div>
                    ) : (
                      <div>{day.getDate()}</div>
                    )}
                    <div className="hidden sm:block">{WEEKDAYS[(day.getDay() + 6) % 7]}</div>
                  </div>
                );
              })}
            </div>

            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onOrderClick(order)}
                onMouseEnter={(e) => {
                  setHoveredOrder(order);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredOrder(null)}
                className="grid w-full text-left group hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors border-b border-gray-100 dark:border-gray-700/80"
                style={{
                  gridTemplateColumns: `minmax(11rem, 14rem) repeat(${daysInMonth}, minmax(1.75rem, 1fr))`,
                }}
              >
                <div className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/40">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {order.client}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {orderSubline ? orderSubline(order) : order.invoice_id}
                  </div>
                </div>
                {days.map((day) => {
                  const active = isOrderActiveOnDay(order, day);
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameCalendarDay(day, today);
                  return (
                    <div
                      key={`${order.id}-${day.toISOString()}`}
                      className={`border-r border-gray-50 dark:border-gray-700/50 min-h-[2.75rem] ${dayCellBackground(isToday, weekend, active)}`}
                    >
                      {active && (
                        <div
                          className={`h-full min-h-[2.75rem] ${
                            order.approved ? approvedBarClass(isToday) : 'bg-amber-300/55'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          {orders.length} kampanij{orders.length === 1 ? 'a' : 'os'} šį mėnesį
        </div>
      )}
    </div>
  );
}
