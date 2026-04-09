'use client';

import { useCallback, useEffect, useState } from 'react';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';

interface RecentApprovedOrdersProps {
  onEditOrder?: (order: Order) => void;
  refreshKey?: number;
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

export function RecentApprovedOrders({ onEditOrder, refreshKey }: RecentApprovedOrdersProps) {
  const currentYear = new Date().getFullYear();
  const [rows, setRows] = useState<
    Array<{
      key: string;
      orderId: string;
      approvedAt: string;
      order?: Order;
      snapshotClient?: string | null;
      snapshotAmount?: number | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [approvalStats, setApprovalStats] = useState<{ approved: number; total: number } | null>(null);

  const fetchRecentApproved = useCallback(async () => {
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

      setUsingFallback(false);

      try {
        const events = await SupabaseService.getRecentApprovalEvents(50);
        const uniqueOrderIds = [...new Set(events.map(event => event.order_id))];
        const eventOrders = await PocketBaseService.getOrdersBatch(uniqueOrderIds);
        const orderMap = new Map(eventOrders.map(order => [order.id, order]));

        const mappedRows = events
          .map(event => ({
            key: event.id,
            orderId: event.order_id,
            approvedAt: event.approved_at,
            order: orderMap.get(event.order_id),
            snapshotClient: event.snapshot_client,
            snapshotAmount: event.snapshot_amount,
          }))
          // Show only currently active approvals.
          .filter(row => row.order?.approved);
        
        // Keep only the newest approval event per order to avoid duplicates in the UI.
        const latestByOrder = new Map<string, (typeof mappedRows)[number]>();
        for (const row of mappedRows) {
          if (!latestByOrder.has(row.orderId)) {
            latestByOrder.set(row.orderId, row);
          }
        }
        setRows(Array.from(latestByOrder.values()));
      } catch {
        // Fallback for environments where approval-events table is not set up yet.
        setUsingFallback(true);
        const result = await PocketBaseService.getOrders({
          page: 1,
          perPage: 50,
          sort: '-updated',
          filter: 'approved=true',
        });

        setRows(
          (result.items || []).map(order => ({
            key: order.id,
            orderId: order.id,
            approvedAt: order.updated,
            order,
            snapshotClient: order.client,
            snapshotAmount: order.final_price,
          }))
        );
      }
    } catch {
      setRows([]);
      setError('Nepavyko užkrauti naujausių patvirtintų užsakymų.');
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchRecentApproved();
  }, [fetchRecentApproved, refreshKey]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Naujausi patvirtinti</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rodomi paskutiniai 50 patvirtinimo įrašų.
          </p>
          {approvalStats && approvalStats.total > 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Patvirtinta kampanijų šiais metais ({currentYear}): <span className="font-semibold">{((approvalStats.approved / approvalStats.total) * 100).toFixed(1)}%</span>{' '}
              ({approvalStats.approved} iš {approvalStats.total})
            </p>
          )}
          {usingFallback && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Rodoma pagal atnaujinimo datą, kol Supabase patvirtinimų lentelė nepasiekiama.
            </p>
          )}
        </div>
        <button
          onClick={fetchRecentApproved}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Atnaujinti
        </button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 bg-gray-100 dark:bg-gray-700 animate-pulse rounded"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Nerasta patvirtintų užsakymų.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Klientas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Agentūra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Užsakymo Nr.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Suma
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={onEditOrder ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : undefined}
                  onClick={() => row.order && onEditOrder?.(row.order)}
                >
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {formatUpdated(row.approvedAt)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {row.order?.client || row.snapshotClient || `ID: ${row.orderId.slice(0, 8)}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {row.order?.agency || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {row.order?.invoice_id || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €
                    {(row.order?.final_price ?? row.snapshotAmount ?? 0).toLocaleString('lt-LT', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
