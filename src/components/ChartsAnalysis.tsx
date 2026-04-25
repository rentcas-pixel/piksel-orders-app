'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Order, Screen } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { getDaysInMonth, getDaysInRange } from '@/lib/screen-revenue';

interface ChartsAnalysisProps {
  filters: { month: string; year: string; status: string };
}

const MONTH_NAMES = ['Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir', 'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Grd'];
const FETCH_LIMIT = 2000;

function AreaLineChart({
  data,
  color = '#6366f1',
  idPrefix,
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  idPrefix: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 900;
  const height = 280;
  const padX = 38;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const max = Math.max(...data.map((d) => d.value), 1);

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padY + chartH - (d.value / max) * chartH;
    return { ...d, x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${padX + chartW} ${padY + chartH} L ${padX} ${padY + chartH} Z`;
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50/60 dark:from-gray-800 dark:to-gray-800/80 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Pajamų grafikas">
        <defs>
          <linearGradient id={`${idPrefix}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <rect x={padX} y={padY} width={chartW} height={chartH} fill="transparent" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + chartH - t * chartH;
          return (
            <line
              key={t}
              x1={padX}
              y1={y}
              x2={padX + chartW}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.12"
              className="text-gray-500"
            />
          );
        })}
        <path d={areaPath} fill={`url(#${idPrefix}-area)`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {points.map((p, idx) => (
          <g key={p.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === idx ? 6 : 3.5}
              fill={color}
              style={{ transition: 'r 120ms ease' }}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="14"
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          </g>
        ))}
        {hoveredPoint && (
          <g pointerEvents="none">
            <rect
              x={Math.max(padX, Math.min(hoveredPoint.x - 65, padX + chartW - 130))}
              y={Math.max(4, hoveredPoint.y - 36)}
              width="130"
              height="24"
              rx="6"
              fill="#111827"
              fillOpacity="0.9"
            />
            <text
              x={Math.max(padX, Math.min(hoveredPoint.x, padX + chartW))}
              y={Math.max(20, hoveredPoint.y - 20)}
              textAnchor="middle"
              style={{ fontSize: 11, fill: '#ffffff' }}
            >
              {hoveredPoint.label}: €{hoveredPoint.value.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
            </text>
          </g>
        )}
        {points.map((p) => (
          <text
            key={`${p.label}-x`}
            x={p.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400"
            style={{ fontSize: 11 }}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function ChartsAnalysis({ filters }: ChartsAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [screensById, setScreensById] = useState<Record<string, Screen>>({});
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const year = parseInt(filters.year, 10) || new Date().getFullYear();

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const filter = `(from<="${year}-12-31" && to>="${year}-01-01") && approved=true`;
      const perPage = 250;
      let page = 1;
      let totalPages = 1;
      const allOrders: Order[] = [];
      do {
        const result = await PocketBaseService.getOrders({ page, perPage, sort: '-updated', filter });
        allOrders.push(...(result.items || []));
        totalPages = result.totalPages || 1;
        page += 1;
      } while (page <= totalPages && allOrders.length < FETCH_LIMIT);

      const screens = await PocketBaseService.getAllScreens();
      const byId: Record<string, Screen> = {};
      for (const s of screens) byId[s.id] = s;

      setScreensById(byId);
      setOrders(allOrders.slice(0, FETCH_LIMIT));
    } catch {
      setOrders([]);
      setScreensById({});
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const { yearSeries, screenTotals, screenSeriesMap } = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ label: MONTH_NAMES[i], value: 0 }));
    const byScreenMonth = new Map<string, number[]>();

    for (const order of orders) {
      const total = Number(order.final_price) || 0;
      const totalDays = getDaysInRange(order.from, order.to);
      const screenIds = [...new Set(order.screens?.filter(Boolean) || [])];
      if (total <= 0 || totalDays <= 0 || screenIds.length === 0) continue;

      for (let m = 1; m <= 12; m++) {
        const daysInMonth = getDaysInMonth(order.from, order.to, year, m);
        if (daysInMonth <= 0) continue;
        const amount = (total / totalDays) * daysInMonth;
        months[m - 1].value += amount;

        const perScreenAmount = amount / screenIds.length;
        for (const screenId of screenIds) {
          const arr = byScreenMonth.get(screenId) || Array.from({ length: 12 }, () => 0);
          arr[m - 1] += perScreenAmount;
          byScreenMonth.set(screenId, arr);
        }
      }
    }

    const totals = Array.from(byScreenMonth.entries())
      .map(([screenId, arr]) => ({
        screenId,
        screenName: screensById[screenId]?.name || `ID: ${screenId.slice(0, 6)}`,
        total: arr.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.total - a.total);

    return { yearSeries: months, screenTotals: totals, screenSeriesMap: byScreenMonth };
  }, [orders, screensById, year]);

  useEffect(() => {
    if (!selectedScreenId && screenTotals.length > 0) setSelectedScreenId(screenTotals[0].screenId);
  }, [selectedScreenId, screenTotals]);
  const selectedScreenSeries = useMemo(() => {
    const arr = screenSeriesMap.get(selectedScreenId) || Array.from({ length: 12 }, () => 0);
    return arr.map((value, idx) => ({ label: MONTH_NAMES[idx], value }));
  }, [screenSeriesMap, selectedScreenId]);

  if (loading) {
    return <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500">Grafikai kraunami...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/90 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{year} pajamos pagal mėnesius</h3>
        <AreaLineChart data={yearSeries} color="#7c6cf6" idPrefix="year-revenue" />
      </div>

      <div className="bg-white/90 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ekrano pajamos pagal mėnesius</h3>
          <select
            value={selectedScreenId}
            onChange={(e) => setSelectedScreenId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {screenTotals.slice(0, 200).map((s) => (
              <option key={s.screenId} value={s.screenId}>
                {s.screenName} - €{s.total.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
              </option>
            ))}
          </select>
        </div>
        <AreaLineChart data={selectedScreenSeries} color="#13b981" idPrefix="screen-revenue" />
      </div>

    </div>
  );
}
