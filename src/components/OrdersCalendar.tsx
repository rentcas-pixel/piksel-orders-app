'use client';

import { useCallback, useEffect, useState } from 'react';
import { Order } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { buildOrdersCalendarFilter, type OrdersListFilters } from '@/lib/orders-filters';
import { readInvoiceStatusField } from '@/lib/invoice-month-status';
import { OrdersGanttCalendar } from '@/components/OrdersGanttCalendar';

interface OrdersCalendarProps {
  searchQuery: string;
  filters: OrdersListFilters;
  onEditOrder: (order: Order) => void;
}

export function OrdersCalendar({ searchQuery, filters, onEditOrder }: OrdersCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;

  const buildFilterString = useCallback(
    () =>
      buildOrdersCalendarFilter({
        searchQuery,
        filters,
        year,
        month,
      }),
    [searchQuery, filters, year, month]
  );

  useEffect(() => {
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

        let items = (result.items || []).filter((o) => o.from && o.to);

        if (filters.invoice_sent) {
          const billingContext = { month: String(month).padStart(2, '0'), year: String(year) };
          const statusMap = await SupabaseService.getMonthInvoiceStatuses(items, billingContext);
          items = items.filter((order) => {
            const issued = readInvoiceStatusField(order, statusMap[order.id], 'invoice_issued');
            return filters.invoice_sent === 'true' ? issued : !issued;
          });
        }

        items.sort((a, b) => a.client.localeCompare(b.client, 'lt'));

        if (!cancelled) setOrders(items);
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
  }, [buildFilterString, filters.invoice_sent]);

  return (
    <OrdersGanttCalendar
      orders={orders}
      loading={loading}
      viewDate={viewDate}
      onViewDateChange={setViewDate}
      onOrderClick={onEditOrder}
      orderSubline={(order) => {
        const agency = order.agency?.trim();
        if (agency && agency !== '-') {
          return `${agency} · ${order.invoice_id}`;
        }
        return order.invoice_id;
      }}
    />
  );
}
