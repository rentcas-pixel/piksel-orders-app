'use client';

import { useCallback, useEffect, useState } from 'react';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { buildAgencyCalendarFilter, type AgencyListFilters } from '@/lib/agency-orders';
import { OrdersGanttCalendar } from '@/components/OrdersGanttCalendar';

interface AgencyOrdersCalendarProps {
  agency: string;
  searchQuery: string;
  filters: AgencyListFilters;
  onOrderClick: (order: Order) => void;
}

export function AgencyOrdersCalendar({
  agency,
  searchQuery,
  filters,
  onOrderClick,
}: AgencyOrdersCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const buildFilterString = useCallback(
    () =>
      buildAgencyCalendarFilter({
        agency,
        searchQuery,
        filters: { status: filters.status, client: filters.client },
        year,
        month,
      }),
    [agency, searchQuery, filters.status, filters.client, year, month]
  );

  useEffect(() => {
    if (!agency.trim()) {
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await PocketBaseService.getOrders({
          page: 1,
          perPage: 500,
          sort: 'client',
          filter: buildFilterString(),
        });
        if (!cancelled) {
          const items = (result.items || []).filter((o) => o.from && o.to);
          items.sort((a, b) => a.client.localeCompare(b.client, 'lt'));
          setOrders(items);
        }
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [agency, buildFilterString]);

  if (!agency.trim()) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
        Pasirinkite agentūrą, kad pamatytumėte kalendorių.
      </div>
    );
  }

  return (
    <OrdersGanttCalendar
      orders={orders}
      loading={loading}
      viewDate={viewDate}
      onViewDateChange={setViewDate}
      onOrderClick={onOrderClick}
      orderSubline={(order) => order.invoice_id}
    />
  );
}
