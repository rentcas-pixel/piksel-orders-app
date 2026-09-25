'use client';

import { useEffect, useState } from 'react';
import {
  evaluateOrderClips,
  listOrderClips,
  resolveOrderClipScreens,
} from '@/lib/order-clips';
import { fetchAdminState, fetchMonitoring } from '@/lib/player-devices';
import {
  collectOrderScreenAlerts,
  type NamedScreenAlert,
} from '@/lib/screen-clip-alert';
import type { Order } from '@/types';

export function useOrderScreenAlerts(
  order: Order | null,
  liveActive: boolean,
  liveSentScreenNames?: string[]
): NamedScreenAlert[] {
  const [alerts, setAlerts] = useState<NamedScreenAlert[]>([]);

  useEffect(() => {
    if (!order?.id) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [screens, clips, state, monitoring] = await Promise.all([
        resolveOrderClipScreens(order),
        listOrderClips(order.id),
        fetchAdminState(),
        fetchMonitoring(),
      ]);
      if (cancelled) return;
      const evaluation = evaluateOrderClips(screens, clips);
      const campaign = state.ok
        ? state.campaigns.find((item) => String(item.id) === String(order.id))
        : undefined;
      const liveNames = liveSentScreenNames?.length
        ? liveSentScreenNames
        : order.details?.live?.screenNames;
      const liveExpected =
        liveActive ||
        (Boolean(campaign) && campaign?.published !== false) ||
        (Array.isArray(liveNames) && liveNames.length > 0);
      setAlerts(
        collectOrderScreenAlerts({
          screens: evaluation.pikselScreens,
          coveredScreenNames: evaluation.publishableScreenNames,
          devices: state.ok ? state.devices : null,
          monitors: monitoring.ok ? monitoring.data?.screens || [] : null,
          liveExpected,
          sentScreenNames: Array.isArray(liveNames) ? liveNames : [],
          orderId: order.id,
          client: order.client,
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [
    order?.id,
    order?.client,
    order?.updated,
    order?.details?.live?.publishedAt,
    liveActive,
    liveSentScreenNames?.join(','),
  ]);

  return alerts;
}
