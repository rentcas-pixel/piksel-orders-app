'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { LATEST_SUB_TABS, type LatestSubTab } from '@/lib/app-navigation';
import { staleUnapprovedCutoffIso } from '@/lib/orders-filters';
import {
  formatVilniusDateLabel,
  getVilniusDateKey,
} from '@/lib/vilnius-date';
import {
  portalCardClass,
  portalExportBtnClass,
  portalRowHoverClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalToolbarClass,
} from '@/lib/portal-ui';

interface RecentApprovedOrdersProps {
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
}

type RecentOrderRow = {
  key: string;
  orderId: string;
  sortAt: string;
  order?: Order;
  snapshotClient?: string | null;
  snapshotAmount?: number | null;
};

type DayGroup = {
  dateKey: string;
  rows: RecentOrderRow[];
  count: number;
  sum: number;
};

type DayTotalsMap = Record<string, { count: number; sum: number }>;

const AUTO_REFRESH_MS = 60_000;
const HIGH_AMOUNT_THRESHOLD = 5_000;

function highAmountClass(active: boolean): string {
  return active
    ? 'font-semibold text-amber-700 dark:text-amber-300'
    : 'font-medium text-gray-900 dark:text-white';
}

function formatUpdated(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString('lt-LT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rowAmount(row: RecentOrderRow): number {
  return Number(row.order?.final_price ?? row.snapshotAmount ?? 0);
}

function formatOrderCount(count: number): string {
  if (count === 1) return '1 užsakymas';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} užsakymas`;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return `${count} užsakymai`;
  return `${count} užsakymų`;
}

function groupRowsByDay(rows: RecentOrderRow[], dayTotals?: DayTotalsMap): DayGroup[] {
  const groups = new Map<string, RecentOrderRow[]>();

  for (const row of rows) {
    const dateKey = getVilniusDateKey(row.sortAt);
    if (!dateKey) continue;
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(row);
    groups.set(dateKey, bucket);
  }

  if (dayTotals) {
    for (const [dateKey, totals] of Object.entries(dayTotals)) {
      if (totals.count > 0 && !groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
    }
  }

  return [...groups.entries()]
    .map(([dateKey, dayRows]) => {
      const override = dayTotals?.[dateKey];
      const sum = override?.sum ?? dayRows.reduce((total, row) => total + rowAmount(row), 0);
      const count = override?.count ?? dayRows.length;
      return {
        dateKey,
        rows: dayRows.sort(
          (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
        ),
        count,
        sum,
      };
    })
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function DayTotalRow({
  dateKey,
  count,
  sum,
  isToday,
  highlightHighAmounts = false,
}: {
  dateKey: string;
  count: number;
  sum: number;
  isToday: boolean;
  highlightHighAmounts?: boolean;
}) {
  const label = formatVilniusDateLabel(dateKey);
  const sumIsHigh = highlightHighAmounts && sum > HIGH_AMOUNT_THRESHOLD;

  return (
    <tr
      className={
        isToday
          ? 'bg-blue-50/80 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100'
          : 'bg-gray-50 text-gray-700 dark:bg-gray-900/60 dark:text-gray-300'
      }
    >
      <td colSpan={5} className="px-4 py-2.5 text-sm border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold">{label}</span>
        <span className="mx-2 text-gray-400">—</span>
        <span>
          {formatOrderCount(count)},{' '}
          suma{' '}
          <span className={sumIsHigh ? 'font-semibold text-amber-700 dark:text-amber-300' : undefined}>
            €{formatMoney(sum)}
          </span>
        </span>
        {isToday && (
          <span className="ml-2 text-xs text-blue-700/80 dark:text-blue-200/80">(šiandien)</span>
        )}
      </td>
    </tr>
  );
}

const recentOrdersTdClass = 'px-4 py-3 text-sm';
const recentOrdersThClass = `${portalStickyThClass} px-4 py-3`;

function RecentOrdersTable({
  dayGroups,
  dateColumnLabel,
  onEditOrder,
  highlightHighAmounts = false,
}: {
  dayGroups: DayGroup[];
  dateColumnLabel: string;
  onEditOrder?: (order: Order) => void;
  highlightHighAmounts?: boolean;
}) {
  const todayKey = getVilniusDateKey();

  return (
    <div className={portalTableScrollClass}>
      <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
        <colgroup>
          <col className="w-[11rem]" />
          <col />
          <col className="w-[10rem]" />
          <col className="w-[9rem]" />
          <col className="w-[7.5rem]" />
        </colgroup>
        <thead className={portalStickyTheadClass}>
          <tr>
            <th className={recentOrdersThClass}>{dateColumnLabel}</th>
            <th className={recentOrdersThClass}>Klientas</th>
            <th className={recentOrdersThClass}>Agentūra</th>
            <th className={recentOrdersThClass}>Užsakymo Nr.</th>
            <th className={`${recentOrdersThClass} text-right`}>Suma</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {dayGroups.map((group) => (
            <Fragment key={group.dateKey}>
              <DayTotalRow
                dateKey={group.dateKey}
                count={group.count}
                sum={group.sum}
                isToday={group.dateKey === todayKey}
                highlightHighAmounts={highlightHighAmounts}
              />
              {group.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${recentOrdersTdClass} text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700`}
                  >
                    Šios dienos užsakymai nepatenka į paskutinių 50 sąrašą.
                  </td>
                </tr>
              ) : (
                group.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={onEditOrder ? portalRowHoverClass : undefined}
                    onClick={() => row.order && onEditOrder?.(row.order)}
                  >
                    <td className={`${recentOrdersTdClass} text-gray-600 dark:text-gray-300 whitespace-nowrap`}>
                      {formatUpdated(row.sortAt)}
                    </td>
                    <td
                      className={`${recentOrdersTdClass} font-medium text-gray-900 dark:text-white truncate`}
                      title={row.order?.client || row.snapshotClient || undefined}
                    >
                      {row.order?.client || row.snapshotClient || `ID: ${row.orderId.slice(0, 8)}`}
                    </td>
                    <td
                      className={`${recentOrdersTdClass} text-gray-600 dark:text-gray-300 truncate`}
                      title={row.order?.agency || undefined}
                    >
                      {row.order?.agency || '—'}
                    </td>
                    <td className={`${recentOrdersTdClass} text-gray-600 dark:text-gray-300 truncate`}>
                      {row.order?.invoice_id || '—'}
                    </td>
                    <td
                      className={`${recentOrdersTdClass} text-right ${highAmountClass(highlightHighAmounts && rowAmount(row) > HIGH_AMOUNT_THRESHOLD)}`}
                    >
                      €{formatMoney(rowAmount(row))}
                    </td>
                  </tr>
                ))
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-10 bg-gray-100 dark:bg-gray-700 animate-pulse rounded"
        />
      ))}
    </div>
  );
}

async function fetchApprovedDayTotals(dateKey: string): Promise<{ count: number; sum: number }> {
  const events = await SupabaseService.getApprovalEventsForVilniusDay(dateKey);
  if (events.length === 0) return { count: 0, sum: 0 };

  const missingOrderIds = events
    .filter((event) => event.snapshot_amount == null)
    .map((event) => event.order_id);

  let ordersById = new Map<string, Order>();
  if (missingOrderIds.length > 0) {
    const orders = await PocketBaseService.getOrdersBatch(missingOrderIds);
    ordersById = new Map(orders.map((order) => [order.id, order]));
  }

  const sum = events.reduce((total, event) => {
    const amount =
      event.snapshot_amount ??
      ordersById.get(event.order_id)?.final_price ??
      0;
    return total + Number(amount);
  }, 0);

  return { count: events.length, sum };
}

async function fetchUnapprovedDayTotals(dateKey: string): Promise<{ count: number; sum: number }> {
  const cutoff = staleUnapprovedCutoffIso();
  const result = await PocketBaseService.getOrders({
    page: 1,
    perPage: 500,
    sort: '-updated',
    filter: `approved=false && from>="${cutoff}"`,
  });

  const todayRows = (result.items || []).filter(
    (order) => getVilniusDateKey(order.updated) === dateKey
  );

  return {
    count: todayRows.length,
    sum: todayRows.reduce((total, order) => total + Number(order.final_price || 0), 0),
  };
}

function ApprovedContent({
  onEditOrder,
  refreshKey,
}: {
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
}) {
  const currentYear = new Date().getFullYear();
  const todayKey = getVilniusDateKey();
  const [rows, setRows] = useState<RecentOrderRow[]>([]);
  const [dayTotals, setDayTotals] = useState<DayTotalsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimatedDateCount, setEstimatedDateCount] = useState(0);
  const [approvalStats, setApprovalStats] = useState<{ approved: number; total: number } | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      try {
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;
        const yearRangeFilter = `(from<="${yearEnd}" && to>="${yearStart}")`;

        const [allOrdersResult, approvedOrdersResult] = await Promise.all([
          PocketBaseService.getOrders({
            page: 1,
            perPage: 1,
            sort: '-updated',
            filter: yearRangeFilter,
          }),
          PocketBaseService.getOrders({
            page: 1,
            perPage: 1,
            sort: '-updated',
            filter: `approved=true && ${yearRangeFilter}`,
          }),
        ]);

        setApprovalStats({
          approved: approvedOrdersResult.totalItems || 0,
          total: allOrdersResult.totalItems || 0,
        });
      } catch {
        setApprovalStats(null);
      }

      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 50,
        sort: '-updated',
        filter: 'approved=true',
      });

      const activeApprovedOrders = result.items || [];
      const orderIds = activeApprovedOrders.map((order) => order.id);

      let latestEventsByOrder: Record<string, { approved_at: string }> = {};
      try {
        latestEventsByOrder = await SupabaseService.getLatestApprovalEventsByOrderIds(orderIds);
      } catch {
        latestEventsByOrder = {};
      }

      const mappedRows = activeApprovedOrders
        .map((order) => {
          const latestEvent = latestEventsByOrder[order.id];
          return {
            key: latestEvent?.approved_at ? `${order.id}-${latestEvent.approved_at}` : order.id,
            orderId: order.id,
            sortAt: latestEvent?.approved_at || order.updated,
            order,
            snapshotClient: order.client,
            snapshotAmount: order.final_price,
          };
        })
        .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

      setEstimatedDateCount(mappedRows.filter((row) => !latestEventsByOrder[row.orderId]).length);
      setRows(mappedRows);

      const totals: DayTotalsMap = {};
      try {
        totals[todayKey] = await fetchApprovedDayTotals(todayKey);
      } catch {
        // keep list-only totals for today
      }
      setDayTotals(totals);
    } catch {
      setRows([]);
      setDayTotals({});
      setEstimatedDateCount(0);
      setError('Nepavyko užkrauti patvirtintų užsakymų.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, todayKey]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchRows();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchRows]);

  const dayGroups = groupRowsByDay(rows, dayTotals);

  return (
    <>
      <div className={portalToolbarClass}>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paskutiniai 50 patvirtinimų, sugrupuoti pagal dieną (Vilniaus laikas).
          </p>
          {approvalStats && approvalStats.total > 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Patvirtinta kampanijų šiais metais ({currentYear}):{' '}
              <span className="font-semibold">
                {((approvalStats.approved / approvalStats.total) * 100).toFixed(1)}%
              </span>{' '}
              ({approvalStats.approved} iš {approvalStats.total})
            </p>
          )}
          {estimatedDateCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {estimatedDateCount} įraš. data paimta iš atnaujinimo laiko, nes jiems dar nėra
              patvirtinimo event.
            </p>
          )}
        </div>
        <button onClick={fetchRows} className={portalExportBtnClass}>
          Atnaujinti
        </button>
      </div>

      {loading ? (
        <SectionSkeleton />
      ) : error ? (
        <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : dayGroups.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Nerasta patvirtintų užsakymų.
        </div>
      ) : (
        <RecentOrdersTable
          dayGroups={dayGroups}
          dateColumnLabel="Patvirtinta"
          onEditOrder={onEditOrder}
          highlightHighAmounts
        />
      )}
    </>
  );
}

function UnapprovedContent({
  onEditOrder,
  refreshKey,
}: {
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
}) {
  const todayKey = getVilniusDateKey();
  const [rows, setRows] = useState<RecentOrderRow[]>([]);
  const [dayTotals, setDayTotals] = useState<DayTotalsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cutoff = staleUnapprovedCutoffIso();
      const result = await PocketBaseService.getOrders({
        page: 1,
        perPage: 50,
        sort: '-updated',
        filter: `approved=false && from>="${cutoff}"`,
      });

      const mappedRows = (result.items || [])
        .map((order) => ({
          key: order.id,
          orderId: order.id,
          sortAt: order.updated,
          order,
          snapshotClient: order.client,
          snapshotAmount: order.final_price,
        }))
        .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

      setRows(mappedRows);

      try {
        const todayTotals = await fetchUnapprovedDayTotals(todayKey);
        setDayTotals({ [todayKey]: todayTotals });
      } catch {
        setDayTotals({});
      }
    } catch {
      setRows([]);
      setDayTotals({});
      setError('Nepavyko užkrauti nepatvirtintų užsakymų.');
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchRows();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchRows]);

  const dayGroups = groupRowsByDay(rows, dayTotals);

  return (
    <>
      <div className={portalToolbarClass}>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Paskutiniai 50 nepatvirtintų užsakymų, sugrupuoti pagal dieną (Vilniaus laikas).
          </p>
        </div>
        <button onClick={fetchRows} className={portalExportBtnClass}>
          Atnaujinti
        </button>
      </div>

      {loading ? (
        <SectionSkeleton />
      ) : error ? (
        <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : dayGroups.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Nerasta aktyvių nepatvirtintų užsakymų.
        </div>
      ) : (
        <RecentOrdersTable
          dayGroups={dayGroups}
          dateColumnLabel="Atnaujinta"
          onEditOrder={onEditOrder}
          highlightHighAmounts
        />
      )}
    </>
  );
}

export function RecentApprovedOrders({ onEditOrder, refreshKey }: RecentApprovedOrdersProps) {
  const [subTab, setSubTab] = useState<LatestSubTab>('approved');

  return (
    <div>
      <div className="mb-4">
        <FilterTabGroup
          label="Naujausi užsakymai"
          value={subTab}
          options={LATEST_SUB_TABS}
          onChange={setSubTab}
        />
      </div>

      <div className={portalCardClass}>
        {subTab === 'approved' ? (
          <ApprovedContent onEditOrder={onEditOrder} refreshKey={refreshKey} />
        ) : (
          <UnapprovedContent onEditOrder={onEditOrder} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
}
