'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { getDaysInMonth, getDaysInRange } from '@/lib/screen-revenue';

interface OrderAnalyticsDashboardProps {
  filters: { month: string; year: string; status: string };
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
}

type Severity = 'critical' | 'warning';

interface OrderAnomaly {
  order: Order;
  severity: Severity;
  type: string;
  reason: string;
}

interface OwnerMonthComparison {
  owner: string;
  previousRevenue: number;
  currentRevenue: number;
  delta: number;
  deltaPct: number | null;
}

interface OwnerContribution {
  owner: string;
  order: Order;
  previousRevenue: number;
  currentRevenue: number;
  delta: number;
}

const ANALYTICS_CACHE_TTL = 10 * 60 * 1000;
const ANALYTICS_FETCH_LIMIT = 1200;
const analyticsCache = new Map<string, { orders: Order[]; expires: number }>();
const STALE_UNAPPROVED_DAYS = 21;
const LOW_DAY_PRICE_WARNING = 15;
const LOW_DAY_PRICE_CRITICAL = 8;
const PACKAGE_DISCOUNT_TARGET = 86;
const PACKAGE_DISCOUNT_WARNING_DEVIATION = 5;
const PACKAGE_DISCOUNT_CRITICAL_DEVIATION = 10;
const HIDE_UNAPPROVED_AFTER_DAYS = 30;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function getFilterForPeriod(filters: { month: string; year: string }) {
  if (filters.month && filters.year) {
    const y = parseInt(filters.year, 10);
    const m = parseInt(filters.month, 10);
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
    const endDate = `${filters.year}-${filters.month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return `(from<="${endDate}" && to>="${startDate}")`;
  }
  if (filters.year) {
    return `(from<="${filters.year}-12-31" && to>="${filters.year}-01-01")`;
  }
  return '';
}

function getComparisonTarget(filters: { month: string; year: string }) {
  const year = parseInt(filters.year, 10);
  if (!year) return null;

  if (filters.month) {
    return { month: parseInt(filters.month, 10), year };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  if (year < currentYear) return { month: 12, year };
  if (year > currentYear) return { month: 1, year };
  return { month: now.getMonth() + 1, year };
}

export function OrderAnalyticsDashboard({ filters, onEditOrder, refreshKey }: OrderAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ownerComparisons, setOwnerComparisons] = useState<OwnerMonthComparison[]>([]);
  const [ownerContributions, setOwnerContributions] = useState<OwnerContribution[]>([]);
  const [allScreens, setAllScreens] = useState<Array<{ id: string; city?: string }>>([]);
  const [selectedOwnerForDrilldown, setSelectedOwnerForDrilldown] = useState<string | null>(null);
  const [showStaleOrders, setShowStaleOrders] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const periodFilter = useMemo(
    () => getFilterForPeriod({ month: filters.month, year: filters.year }),
    [filters.month, filters.year]
  );
  const comparisonTarget = useMemo(
    () => getComparisonTarget({ month: filters.month, year: filters.year }),
    [filters.month, filters.year]
  );

  const fetchData = useCallback(async () => {
    const cacheKey = periodFilter || 'all';
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      setOrders(cached.orders);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    try {
      const perPage = 250;
      const allOrders: Order[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await PocketBaseService.getOrders({
          page,
          perPage,
          sort: '-updated',
          filter: periodFilter,
        });

        allOrders.push(...(result.items || []));
        totalPages = result.totalPages || 1;
        page += 1;
      } while (page <= totalPages && allOrders.length < ANALYTICS_FETCH_LIMIT);

      const sliced = allOrders.slice(0, ANALYTICS_FETCH_LIMIT);
      setOrders(sliced);
      const screens = await PocketBaseService.getAllScreens();
      setAllScreens(screens.map((s) => ({ id: s.id, city: s.city })));
      analyticsCache.set(cacheKey, { orders: sliced, expires: Date.now() + ANALYTICS_CACHE_TTL });

      if (comparisonTarget) {
        const currentMonth = comparisonTarget.month;
        const currentYear = comparisonTarget.year;
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const previousStart = `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`;
        const currentLastDay = new Date(currentYear, currentMonth, 0).getDate();
        const currentEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentLastDay).padStart(2, '0')}`;

        const comparisonFilter = [
          'approved=true',
          `(from<="${currentEnd}" && to>="${previousStart}")`,
        ].join(' && ');

        const comparisonOrdersResult = await PocketBaseService.getOrders({
          page: 1,
          perPage: 1000,
          sort: '-updated',
          filter: comparisonFilter,
        });
        const comparisonOrders = comparisonOrdersResult.items || [];
        const screenIds = [...new Set(comparisonOrders.flatMap(o => o.screens || []).filter(Boolean))];
        const [screens, partners] = await Promise.all([
          PocketBaseService.getScreensWithPartner(screenIds),
          PocketBaseService.getPartners(),
        ]);
        const partnerById = new Map(partners.map((p) => [p.id, p.name]));

        const previousByOwner = new Map<string, number>();
        const currentByOwner = new Map<string, number>();
        const ownerDetails: OwnerContribution[] = [];

        for (const order of comparisonOrders) {
          const uniqueScreens = [...new Set(order.screens?.filter(Boolean) || [])];
          if (!uniqueScreens.length) continue;
          const totalDays = getDaysInRange(order.from, order.to);
          if (totalDays <= 0) continue;

          const screenBase = (Number(order.final_price) || 0) / uniqueScreens.length;
          const previousDays = getDaysInMonth(order.from, order.to, previousYear, previousMonth);
          const currentDays = getDaysInMonth(order.from, order.to, currentYear, currentMonth);

          for (const screenId of uniqueScreens) {
            const ownerName = partnerById.get(screens[screenId]?.partner || '') || 'Nepriskirtas';
            let previousRevenue = 0;
            let currentRevenue = 0;
            if (previousDays > 0) {
              previousRevenue = (screenBase / totalDays) * previousDays;
              previousByOwner.set(ownerName, (previousByOwner.get(ownerName) || 0) + previousRevenue);
            }
            if (currentDays > 0) {
              currentRevenue = (screenBase / totalDays) * currentDays;
              currentByOwner.set(ownerName, (currentByOwner.get(ownerName) || 0) + currentRevenue);
            }
            if (previousRevenue > 0 || currentRevenue > 0) {
              ownerDetails.push({
                owner: ownerName,
                order,
                previousRevenue,
                currentRevenue,
                delta: currentRevenue - previousRevenue,
              });
            }
          }
        }

        const allOwners = new Set([...previousByOwner.keys(), ...currentByOwner.keys()]);
        const comparisons: OwnerMonthComparison[] = Array.from(allOwners).map((owner) => {
          const previousRevenue = previousByOwner.get(owner) || 0;
          const currentRevenue = currentByOwner.get(owner) || 0;
          const delta = currentRevenue - previousRevenue;
          const deltaPct = previousRevenue > 0 ? (delta / previousRevenue) * 100 : null;
          return { owner, previousRevenue, currentRevenue, delta, deltaPct };
        });

        comparisons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        setOwnerComparisons(comparisons);
        setOwnerContributions(ownerDetails);
      } else {
        setOwnerComparisons([]);
        setOwnerContributions([]);
      }
    } catch {
      setOrders([]);
      setOwnerComparisons([]);
      setOwnerContributions([]);
      setAllScreens([]);
    } finally {
      setLoading(false);
    }
  }, [periodFilter, comparisonTarget]);

  useEffect(() => {
    if (refreshKey !== undefined) analyticsCache.clear();
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData, refreshKey]);

  const analysis = useMemo(() => {
    const now = new Date();
    const visibleOrders = orders.filter((o) => {
      if (o.approved) return true;
      const updated = new Date(o.updated);
      const diffMs = now.getTime() - updated.getTime();
      return diffMs <= HIDE_UNAPPROVED_AFTER_DAYS * 24 * 60 * 60 * 1000;
    });

    const approved = visibleOrders.filter((o) => o.approved);
    const unapproved = visibleOrders.filter((o) => !o.approved);
    const approvedAmount = approved.reduce((sum, o) => {
      const uniqueScreens = [...new Set(o.screens?.filter(Boolean) || [])];
      if (uniqueScreens.length === 0) return sum;

      const total = Number(o.final_price) || 0;
      if (filters.month && filters.year) {
        const year = parseInt(filters.year, 10);
        const month = parseInt(filters.month, 10);
        const totalDays = getDaysInRange(o.from, o.to);
        const daysInMonth = getDaysInMonth(o.from, o.to, year, month);
        if (totalDays <= 0 || daysInMonth <= 0) return sum;
        return sum + (total / totalDays) * daysInMonth;
      }
      return sum + total;
    }, 0);
    const staleUnapproved = unapproved.filter((o) => {
      const updated = new Date(o.updated);
      const diffMs = now.getTime() - updated.getTime();
      return diffMs > STALE_UNAPPROVED_DAYS * 24 * 60 * 60 * 1000;
    });

    const pricePerDayValues = visibleOrders
      .map((o) => {
        const days = getDaysInRange(o.from, o.to);
        if (days <= 0) return 0;
        return (Number(o.final_price) || 0) / days;
      })
      .filter((v) => v > 0);

    const globalMedian = median(pricePerDayValues);
    const absDeviations = pricePerDayValues.map((v) => Math.abs(v - globalMedian));
    const mad = median(absDeviations) || 1;

    const byClient = new Map<string, number[]>();
    for (const order of visibleOrders) {
      const days = getDaysInRange(order.from, order.to);
      const ppd = days > 0 ? (Number(order.final_price) || 0) / days : 0;
      if (ppd <= 0) continue;
      const key = (order.client || '').trim().toLowerCase();
      if (!key) continue;
      const arr = byClient.get(key) || [];
      arr.push(ppd);
      byClient.set(key, arr);
    }
    const clientMedians = new Map<string, number>();
    for (const [clientKey, vals] of byClient.entries()) {
      if (vals.length >= 4) clientMedians.set(clientKey, median(vals));
    }

    const anomalies: OrderAnomaly[] = [];
    const pushAnomaly = (a: OrderAnomaly) => {
      const exists = anomalies.some((x) => x.order.id === a.order.id && x.type === a.type);
      if (!exists) anomalies.push(a);
    };

    const normalizeCity = (city?: string) => {
      const v = (city || '').toLowerCase();
      if (v.includes('viln')) return 'vilnius';
      if (v.includes('kaun')) return 'kaunas';
      return '';
    };
    const cityScreenIds = new Map<string, Set<string>>();
    for (const screen of allScreens) {
      const city = normalizeCity(screen.city);
      if (!city) continue;
      const set = cityScreenIds.get(city) || new Set<string>();
      set.add(screen.id);
      cityScreenIds.set(city, set);
    }

    for (const order of visibleOrders) {
      const total = Number(order.final_price) || 0;
      if (!order.approved && total <= 0) {
        continue;
      }
      const days = Math.max(1, getDaysInRange(order.from, order.to));
      const ppd = total / days;
      const clientKey = (order.client || '').trim().toLowerCase();
      const clientMedian = clientMedians.get(clientKey);
      const robustZ = (ppd - globalMedian) / (1.4826 * mad);

      if (total < 80) {
        pushAnomaly({
          order,
          severity: 'critical',
          type: 'Labai maza suma',
          reason: `Galutine suma tik €${total.toFixed(2)}.`,
        });
      } else if (total < 150) {
        pushAnomaly({
          order,
          severity: 'warning',
          type: 'Maza suma',
          reason: `Galutine suma €${total.toFixed(2)} gali buti neiprasta.`,
        });
      }

      if (ppd < LOW_DAY_PRICE_CRITICAL) {
        pushAnomaly({
          order,
          severity: 'critical',
          type: 'Labai maza dienos kaina',
          reason: `~€${ppd.toFixed(2)}/d. per ${days} d.`,
        });
      } else if (ppd < LOW_DAY_PRICE_WARNING) {
        pushAnomaly({
          order,
          severity: 'warning',
          type: 'Maza dienos kaina',
          reason: `~€${ppd.toFixed(2)}/d. per ${days} d.`,
        });
      }

      if (robustZ < -3) {
        pushAnomaly({
          order,
          severity: 'critical',
          type: 'Kainos outlieris',
          reason: `Dienos kaina yra ryškiai žemiau bendro medianos lygio.`,
        });
      }

      if (clientMedian && ppd < clientMedian * 0.55) {
        pushAnomaly({
          order,
          severity: 'warning',
          type: 'Neiprasta nuolaida (proxy)',
          reason: `Dienos kaina ~${Math.round((1 - ppd / clientMedian) * 100)}% zemiau kliento iprasto lygio.`,
        });
      }

      const orderScreenIds = [...new Set(order.screens?.filter(Boolean) || [])];
      const priceMap = order.details?.screenPrices || {};
      const basePrice = orderScreenIds.reduce((sum, screenId) => sum + (Number(priceMap[screenId]) || 0), 0);
      if (orderScreenIds.length > 0 && basePrice > 0) {
        const cityCandidates = ['kaunas', 'vilnius'].filter((city) => {
          const cityIds = cityScreenIds.get(city);
          if (!cityIds || cityIds.size === 0) return false;
          return orderScreenIds.every((id) => cityIds.has(id));
        });
        const selectedCity = cityCandidates[0] || '';
        const cityIds = selectedCity ? cityScreenIds.get(selectedCity) : undefined;
        const isFullCityPackage = !!cityIds && cityIds.size === orderScreenIds.length;
        const discount = 1 - total / basePrice;

        if (isFullCityPackage) {
          const expectedDiscount = PACKAGE_DISCOUNT_TARGET / 100;
          const deviation = Math.abs(discount - expectedDiscount);
          if (deviation > PACKAGE_DISCOUNT_CRITICAL_DEVIATION / 100) {
            pushAnomaly({
              order,
              severity: 'critical',
              type: 'Nestandartine paketo nuolaida',
              reason: `${selectedCity === 'kaunas' ? 'Kauno' : 'Vilniaus'} paketas: ~${(discount * 100).toFixed(1)}% vietoj ~${PACKAGE_DISCOUNT_TARGET.toFixed(0)}%.`,
            });
          } else if (deviation > PACKAGE_DISCOUNT_WARNING_DEVIATION / 100) {
            pushAnomaly({
              order,
              severity: 'warning',
              type: 'Nuolaida arti paketo ribos',
              reason: `${selectedCity === 'kaunas' ? 'Kauno' : 'Vilniaus'} paketas: ~${(discount * 100).toFixed(1)}%, verta patikrinti.`,
            });
          }
        } else if (discount > 0.75) {
          pushAnomaly({
            order,
            severity: 'warning',
            type: 'Didele nestandartine nuolaida',
            reason: `Apskaiciuota nuolaida ~${(discount * 100).toFixed(1)}% pagal ekranu bazines kainas.`,
          });
        }
      }
    }

    const incidentsByOrder = new Map<string, { order: Order; severity: Severity; reasons: string[]; types: string[]; riskScore: number }>();
    for (const anomaly of anomalies) {
      const existing = incidentsByOrder.get(anomaly.order.id);
      const score = anomaly.severity === 'critical' ? 35 : 20;
      if (!existing) {
        incidentsByOrder.set(anomaly.order.id, {
          order: anomaly.order,
          severity: anomaly.severity,
          reasons: [anomaly.reason],
          types: [anomaly.type],
          riskScore: score,
        });
      } else {
        existing.reasons.push(anomaly.reason);
        existing.types.push(anomaly.type);
        existing.riskScore += score;
        if (anomaly.severity === 'critical') existing.severity = 'critical';
      }
    }
    const incidents = Array.from(incidentsByOrder.values())
      .map((i) => ({ ...i, riskScore: Math.min(100, i.riskScore) }))
      .sort((a, b) => b.riskScore - a.riskScore);

    return {
      total: visibleOrders.length,
      approved: approved.length,
      approvedAmount,
      unapproved: unapproved.length,
      staleUnapproved: staleUnapproved.length,
      staleUnapprovedOrders: staleUnapproved
        .sort((a, b) => new Date(a.updated).getTime() - new Date(b.updated).getTime())
        .slice(0, 50),
      approvalRate: visibleOrders.length ? (approved.length / visibleOrders.length) * 100 : 0,
      anomalies,
      incidents,
    };
  }, [orders, allScreens, filters.month, filters.year]);

  const selectedOwnerRows = useMemo(() => {
    if (!selectedOwnerForDrilldown) return [];
    const grouped = new Map<string, OwnerContribution>();
    for (const row of ownerContributions) {
      if (row.owner !== selectedOwnerForDrilldown) continue;
      const existing = grouped.get(row.order.id);
      if (existing) {
        existing.previousRevenue += row.previousRevenue;
        existing.currentRevenue += row.currentRevenue;
        existing.delta += row.delta;
      } else {
        grouped.set(row.order.id, { ...row });
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 12);
  }, [ownerContributions, selectedOwnerForDrilldown]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-sm text-gray-500 dark:text-gray-400">Analize kraunama...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500">Viso uzsakymu</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{analysis.total}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            Nepatvirtinti &gt;{HIDE_UNAPPROVED_AFTER_DAYS} d. paslepti
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500">Patvirtinti</div>
          <div className="text-2xl font-semibold text-green-600">{analysis.approved}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            {analysis.total ? ((analysis.approved / analysis.total) * 100).toFixed(1) : '0.0'}%
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500">Nepatvirtinti</div>
          <div className="text-2xl font-semibold text-amber-600">{analysis.unapproved}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            {analysis.total ? ((analysis.unapproved / analysis.total) * 100).toFixed(1) : '0.0'}%
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowStaleOrders((v) => !v)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
        >
          <div className="text-xs text-gray-500">Nepatvirtinti &gt;{STALE_UNAPPROVED_DAYS} d.</div>
          <div className="text-2xl font-semibold text-red-600">{analysis.staleUnapproved}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            {analysis.unapproved ? ((analysis.staleUnapproved / analysis.unapproved) * 100).toFixed(1) : '0.0'}% nuo nepatvirtintų
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{showStaleOrders ? 'Paslėpti sąrašą' : 'Rodyti sąrašą'}</div>
        </button>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500">Patvirtinimo rodiklis</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{analysis.approvalRate.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 md:justify-self-end md:w-full">
          <div className="text-xs text-gray-300">Patvirtintų suma</div>
          <div className="text-2xl font-semibold text-white">
            €{analysis.approvedAmount.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {showStaleOrders && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Nepatvirtinti užsakymai (&gt;{STALE_UNAPPROVED_DAYS} d.)
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {analysis.staleUnapprovedOrders.map((order) => (
              <div key={order.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {order.client} / {order.agency} ({order.invoice_id})
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Atnaujinta: {format(new Date(order.updated), 'yyyy-MM-dd')}
                  </div>
                </div>
                {onEditOrder && (
                  <button
                    onClick={() => onEditOrder(order)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Atidaryti
                  </button>
                )}
              </div>
            ))}
            {analysis.staleUnapprovedOrders.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                Nėra nepatvirtintų užsakymų, kurie būtų senesni nei {STALE_UNAPPROVED_DAYS} d.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Anomalijos ir neiprasti atvejai</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Rodo galimai neiprastas nuolaidas, mazas kainas ir kitus rizikos signalus.
          </p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {analysis.incidents.slice(0, 30).map((item) => (
            <div key={item.order.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.order.client} / {item.order.agency} ({item.order.invoice_id})
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {item.reasons[0]}
                  {item.reasons.length > 1 ? ` (+${item.reasons.length - 1} papild.)` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {format(new Date(item.order.from), 'yyyy-MM-dd')} - {format(new Date(item.order.to), 'yyyy-MM-dd')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    item.order.approved
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {item.order.approved ? 'Patvirtintas' : 'Nepatvirtintas'}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    item.severity === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {item.severity}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  Risk {item.riskScore}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {item.types[0]}
                </span>
                {onEditOrder && (
                  <button
                    onClick={() => onEditOrder(item.order)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Atidaryti
                  </button>
                )}
              </div>
            </div>
          ))}
          {analysis.incidents.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Anomaliju pagal dabartinius duomenis nerasta.</div>
          )}
        </div>
      </div>

      {filters.year && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Owner mėnesių palyginimas</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lygina pasirinktą mėnesį su prieš tai buvusiu mėnesiu pagal proporcingai paskirstytas pajamas.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Owner</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Praėjęs mėn.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Dabartinis mėn.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Pokytis €</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Pokytis %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ownerComparisons.slice(0, 20).map((row) => (
                  <tr
                    key={row.owner}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    onClick={() => setSelectedOwnerForDrilldown(row.owner)}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{row.owner}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">€{row.previousRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">€{row.currentRevenue.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`px-4 py-2 text-sm font-medium ${row.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.delta >= 0 ? '+' : ''}€{row.delta.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {row.deltaPct === null ? '-' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {ownerComparisons.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-sm text-center text-gray-500 dark:text-gray-400">
                      Nėra pakankamai duomenų mėnesių palyginimui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedOwnerForDrilldown && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Owner drilldown: {selectedOwnerForDrilldown}
            </h3>
            <button
              onClick={() => setSelectedOwnerForDrilldown(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Uzdaryti
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {selectedOwnerRows.map((row) => (
              <div key={`${row.owner}-${row.order.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm text-gray-900 dark:text-white">
                  <span
                    className={onEditOrder ? 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer' : ''}
                    onClick={() => onEditOrder && onEditOrder(row.order)}
                  >
                    {row.order.client} / {row.order.agency} ({row.order.invoice_id})
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-3">
                  <span>
                    {row.delta >= 0 ? '+' : ''}€{row.delta.toLocaleString('lt-LT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {onEditOrder && (
                    <button
                      onClick={() => onEditOrder(row.order)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Atidaryti
                    </button>
                  )}
                </div>
              </div>
            ))}
            {selectedOwnerRows.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">Nera detaliu siam owneriui.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
