'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { getDaysInMonth, getDaysInRange } from '@/lib/screen-revenue';

interface AgencyAnalysisProps {
  filters: {
    month: string;
    year: string;
    status: string;
    client?: string;
    agency?: string;
    media_received?: string;
  };
  onEditOrder?: (order: Order) => void;
}

interface AgencyRow {
  agency: string;
  totalOrders: number;
  approvedOrders: number;
  unapprovedOrders: number;
  visibleOrders: number;
  approvedRate: number;
  monthlyAmount: number;
  orders: Array<{ order: Order; monthlyAmount: number }>;
}

type SortField = 'agency' | 'totalOrders' | 'approvedOrders' | 'approvedRate' | 'unapprovedOrders' | 'monthlyAmount';
type SortDirection = 'asc' | 'desc';

const ANALYSIS_FETCH_LIMIT = 2000;
const MONTH_NAMES = ['Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir', 'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Grd'];
const AGENCY_CANONICAL: Record<string, string> = {
  bpn: 'BPN',
  omg: 'OMG',
  omd: 'OMD',
  mbd: 'MBD',
  dentsu: 'Dentsu',
  carat: 'Carat',
  mediacom: 'Mediacom',
  mindshare: 'Mindshare',
  'media house': 'Media House',
  'arena media': 'Arena Media',
  havas: 'Havas Media',
  'havas media': 'Havas Media',
  'publicis groupe': 'Publicis Groupe',
  open: 'Open',
};

function normalizeAgencyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getCanonicalAgencyName(value?: string): { key: string; label: string } {
  const raw = (value || '').trim();
  if (!raw || raw === '-') {
    return { key: 'nepriskirta', label: 'Nepriskirta' };
  }
  const key = normalizeAgencyKey(raw);
  return { key, label: AGENCY_CANONICAL[key] || raw };
}

function AreaLineChart({
  data,
  color = '#0ea5e9',
  idPrefix,
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  idPrefix: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 900;
  const height = 260;
  const padX = 34;
  const padY = 18;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padY + chartH - (d.value / max) * chartH;
    return { ...d, x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${padX + chartW} ${padY + chartH} L ${padX} ${padY + chartH} Z`;
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50/60 dark:from-gray-800 dark:to-gray-800/80 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Agentūros pajamų grafikas">
        <defs>
          <linearGradient id={`${idPrefix}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + chartH - t * chartH;
          return <line key={t} x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="currentColor" strokeOpacity="0.12" className="text-gray-500" />;
        })}
        <path d={areaPath} fill={`url(#${idPrefix}-area)`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        {points.map((p, idx) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={hoveredIdx === idx ? 6 : 3.5} fill={color} style={{ transition: 'r 120ms ease' }} />
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
              x={Math.max(padX, Math.min(hoveredPoint.x - 68, padX + chartW - 136))}
              y={Math.max(4, hoveredPoint.y - 36)}
              width="136"
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
          <text key={`${p.label}-x`} x={p.x} y={height - 6} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400" style={{ fontSize: 11 }}>
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function getYearWideFilter(year: string) {
  if (!year) return '';
  return `(from<="${year}-12-31" && to>="${year}-01-01")`;
}

export function AgencyAnalysis({ filters, onEditOrder }: AgencyAnalysisProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null);
  const [selectedAgency, setSelectedAgency] = useState('');
  const [showUnapproved, setShowUnapproved] = useState(false);
  const [sortField, setSortField] = useState<SortField>('monthlyAmount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const abortRef = useRef<AbortController | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection(field === 'agency' ? 'asc' : 'desc');
  };

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      // Keep a full-year dataset so agency chart stays stable
      // when month filter changes; month filter is applied later
      // in local calculations for table amounts.
      const filter = getYearWideFilter(filters.year);
      const perPage = 250;
      let page = 1;
      let totalPages = 1;
      const allOrders: Order[] = [];
      do {
        const result = await PocketBaseService.getOrders({
          page,
          perPage,
          sort: '-updated',
          filter,
        });
        allOrders.push(...(result.items || []));
        totalPages = result.totalPages || 1;
        page += 1;
      } while (page <= totalPages && allOrders.length < ANALYSIS_FETCH_LIMIT);
      setOrders(allOrders.slice(0, ANALYSIS_FETCH_LIMIT));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filters.year]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const rows = useMemo(() => {
    const normalizedClient = (filters.client || '').trim().toLowerCase();
    const normalizedAgencyFilter = normalizeAgencyKey(filters.agency || '');
    const filtered = orders.filter((o) => {
      if (normalizedClient && !(o.client || '').toLowerCase().includes(normalizedClient)) return false;
      const canonical = getCanonicalAgencyName(o.agency);
      if (
        normalizedAgencyFilter &&
        !canonical.key.includes(normalizedAgencyFilter) &&
        !canonical.label.toLowerCase().includes(normalizedAgencyFilter)
      ) {
        return false;
      }
      if (filters.media_received === 'true' && !o.media_received) return false;
      if (filters.media_received === 'false' && o.media_received) return false;
      return true;
    });

    const map = new Map<string, AgencyRow>();
    for (const order of filtered) {
      const canonicalAgency = getCanonicalAgencyName(order.agency);
      const hasScreens = [...new Set(order.screens?.filter(Boolean) || [])].length > 0;
      const year = parseInt(filters.year, 10);
      const month = parseInt(filters.month, 10);
      const existing = map.get(canonicalAgency.label) || {
        agency: canonicalAgency.label,
        totalOrders: 0,
        approvedOrders: 0,
        unapprovedOrders: 0,
        visibleOrders: 0,
        approvedRate: 0,
        monthlyAmount: 0,
        orders: [],
      };
      const total = Number(order.final_price) || 0;
      let monthlyAmount = total;
      let inSelectedMonth = true;
      if (filters.month && filters.year) {
        const totalDays = getDaysInRange(order.from, order.to);
        const daysInMonth = getDaysInMonth(order.from, order.to, year, month);
        inSelectedMonth = daysInMonth > 0;
        if (totalDays > 0 && daysInMonth > 0) {
          monthlyAmount = (total / totalDays) * daysInMonth;
        } else {
          monthlyAmount = 0;
        }
      }

      const isCountableForTable = inSelectedMonth && hasScreens;
      if (isCountableForTable) {
        existing.totalOrders += 1;
        if (order.approved) existing.approvedOrders += 1;
        else existing.unapprovedOrders += 1;
      }

      if (isCountableForTable && (order.approved || showUnapproved)) {
        existing.monthlyAmount += monthlyAmount;
        existing.visibleOrders += 1;
      }

      if (isCountableForTable) {
        existing.orders.push({ order, monthlyAmount });
      }
      map.set(canonicalAgency.label, existing);
    }

    const prepared = Array.from(map.values())
      .map((row) => ({
        ...row,
        approvedRate: row.totalOrders ? (row.approvedOrders / row.totalOrders) * 100 : 0,
      }))
      .filter((row) => row.visibleOrders > 0 && row.monthlyAmount > 0);

    prepared.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'agency') cmp = a.agency.localeCompare(b.agency, 'lt');
      if (sortField === 'totalOrders') cmp = a.totalOrders - b.totalOrders;
      if (sortField === 'approvedOrders') cmp = a.approvedOrders - b.approvedOrders;
      if (sortField === 'approvedRate') cmp = a.approvedRate - b.approvedRate;
      if (sortField === 'unapprovedOrders') cmp = a.unapprovedOrders - b.unapprovedOrders;
      if (sortField === 'monthlyAmount') cmp = a.monthlyAmount - b.monthlyAmount;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return prepared;
  }, [orders, filters.client, filters.agency, filters.media_received, filters.month, filters.year, showUnapproved, sortField, sortDirection]);

  const totalApprovedAmount = rows.reduce((sum, r) => {
    return sum + r.orders
      .filter((x) => x.order.approved && (x.order.screens?.filter(Boolean).length || 0) > 0)
      .reduce((s, x) => s + x.monthlyAmount, 0);
  }, 0);
  const totalUnapprovedAmount = rows.reduce((sum, r) => {
    return sum + r.orders
      .filter((x) => !x.order.approved && (x.order.screens?.filter(Boolean).length || 0) > 0)
      .reduce((s, x) => s + x.monthlyAmount, 0);
  }, 0);
  const totalMonthlyAmount = showUnapproved ? totalApprovedAmount + totalUnapprovedAmount : totalApprovedAmount;
  const selectedYear = parseInt(filters.year, 10) || new Date().getFullYear();

  const { agencyChartTotals, agencyChartSeries } = useMemo(() => {
    const totals = rows.map((r) => {
      const monthly = Array.from({ length: 12 }, () => 0);
      for (const { order } of r.orders) {
        const hasScreens = [...new Set(order.screens?.filter(Boolean) || [])].length > 0;
        if (!hasScreens) continue;
        if (!showUnapproved && !order.approved) continue;
        const total = Number(order.final_price) || 0;
        const totalDays = getDaysInRange(order.from, order.to);
        if (total <= 0 || totalDays <= 0) continue;
        for (let m = 1; m <= 12; m++) {
          const daysInMonth = getDaysInMonth(order.from, order.to, selectedYear, m);
          if (daysInMonth <= 0) continue;
          monthly[m - 1] += (total / totalDays) * daysInMonth;
        }
      }
      return { agency: r.agency, total: monthly.reduce((s, v) => s + v, 0), monthly };
    }).filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);

    const selected = totals.find((x) => x.agency === selectedAgency) || totals[0];
    const series = (selected?.monthly || Array.from({ length: 12 }, () => 0))
      .map((value, idx) => ({ label: MONTH_NAMES[idx], value }));
    return { agencyChartTotals: totals, agencyChartSeries: series };
  }, [rows, selectedAgency, selectedYear, showUnapproved]);

  useEffect(() => {
    if (!selectedAgency && agencyChartTotals.length > 0) setSelectedAgency(agencyChartTotals[0].agency);
  }, [selectedAgency, agencyChartTotals]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-sm text-gray-500 dark:text-gray-400">Agentūrų analizė kraunama...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agentūrų analizė</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Patvirtintų suma: €{totalApprovedAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nepatvirtintų suma: €{totalUnapprovedAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showUnapproved}
              onChange={(e) => setShowUnapproved(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Rodyti ir nepatvirtintus
          </label>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Bendra rodoma mėnesio suma: €{totalMonthlyAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th onClick={() => handleSort('agency')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Agentūra</th>
              <th onClick={() => handleSort('totalOrders')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Užsakymų sk.</th>
              <th onClick={() => handleSort('approvedOrders')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Patvirtinti</th>
              <th onClick={() => handleSort('approvedRate')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Patvirtinti %</th>
              <th onClick={() => handleSort('unapprovedOrders')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Nepatvirtinti</th>
              <th onClick={() => handleSort('monthlyAmount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase cursor-pointer select-none">Suma per mėnesį</th>
              <th className="px-6 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <Fragment key={row.agency}>
                <tr
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                  onClick={() => setExpandedAgency(expandedAgency === row.agency ? null : row.agency)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.agency}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.totalOrders}</td>
                  <td className="px-6 py-4 text-sm text-green-600">{row.approvedOrders}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.approvedRate.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-sm text-amber-600">{row.unapprovedOrders}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €{row.monthlyAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {expandedAgency === row.agency ? '▼' : '▶'}
                  </td>
                </tr>
                {expandedAgency === row.agency && (
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="space-y-2">
                        {row.orders
                          .slice()
                          .filter(({ order }) => showUnapproved || order.approved)
                          .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
                          .map(({ order, monthlyAmount }) => (
                            (() => {
                              const screenCount = [...new Set(order.screens?.filter(Boolean) || [])].length;
                              return (
                            <div
                              key={order.id}
                              className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-sm"
                            >
                              <div className="text-gray-900 dark:text-white">
                                <span
                                  className={onEditOrder ? 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer' : ''}
                                  onClick={() => onEditOrder?.(order)}
                                >
                                  {order.client} ({order.invoice_id})
                                </span>{' '}
                                - {order.approved ? 'Patvirtintas' : 'Nepatvirtintas'}
                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                  Ekranai: {screenCount}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                  {format(new Date(order.from), 'yyyy-MM-dd')} - {format(new Date(order.to), 'yyyy-MM-dd')}
                                </span>
                              </div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                €{monthlyAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                              );
                            })()
                          ))}
                        {row.orders.filter(({ order }) => showUnapproved || order.approved).length === 0 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
                            Nėra rodomų užsakymų pagal pasirinktą būseną.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Pagal pasirinktus filtrus agentūrų duomenų nerasta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {agencyChartTotals.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agentūros pajamos pagal mėnesius</h3>
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {agencyChartTotals.map((a) => (
                <option key={a.agency} value={a.agency}>
                  {a.agency} - €{a.total.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
                </option>
              ))}
            </select>
          </div>
          <AreaLineChart data={agencyChartSeries} color="#0ea5e9" idPrefix="agency-tab-revenue" />
        </div>
      )}
    </div>
  );
}
