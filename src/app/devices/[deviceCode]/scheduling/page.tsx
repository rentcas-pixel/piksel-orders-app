'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { DeviceSchedulingView } from '@/components/DeviceSchedulingView';
import { useAppSession } from '@/hooks/useAppSession';
import {
  fetchAdminState,
  type PlayerCampaign,
  type PlayerDevice,
} from '@/lib/player-devices';
import { listTestOrders, subscribeTestOrders } from '@/lib/test-orders';

export default function DeviceSchedulingPage() {
  const params = useParams();
  const deviceCode = decodeURIComponent(String(params.deviceCode || ''));
  const { session, loading: sessionLoading } = useAppSession();
  const [device, setDevice] = useState<PlayerDevice | null>(null);
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await fetchAdminState();
    if (!result.ok) {
      setError(result.error || 'Nepavyko užkrauti');
      setDevice(null);
      setCampaigns([]);
      setLoading(false);
      return;
    }
    const found =
      result.devices.find((d) => d.deviceCode === deviceCode) || null;
    setDevice(found);
    setCampaigns(result.campaigns);
    if (!found) setError(`Device nerastas: ${deviceCode}`);
    setLoading(false);
  }, [deviceCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const publishedStamp = () =>
      listTestOrders()
        .map((order) => `${order.id}:${order.details?.live?.publishedAt || ''}`)
        .join('|');
    let last = publishedStamp();
    return subscribeTestOrders(() => {
      const next = publishedStamp();
      if (next === last) return;
      last = next;
      void refresh();
    });
  }, [refresh]);

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Kraunama…
      </div>
    );
  }

  if (!session) {
    if (typeof window !== 'undefined') window.location.assign('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppShell onAddOrder={() => {}} userEmail={session.email}>
      <main className="container mx-auto px-4 py-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-gray-400">
          <Link href="/devices" className="hover:text-blue-600">
            Devices
          </Link>
          <span className="mx-1.5 text-gray-300">/</span>
          <span className="text-gray-500">{device?.screenName || deviceCode}</span>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          {device ? `${device.screenName} · ${device.deviceCode}` : deviceCode}
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && !device ? (
          <p className="text-sm text-gray-500">Kraunama…</p>
        ) : device ? (
          <DeviceSchedulingView device={device} campaigns={campaigns} />
        ) : null}
      </main>
      </AppShell>
    </div>
  );
}
