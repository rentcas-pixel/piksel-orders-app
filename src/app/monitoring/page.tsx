'use client';

import { AppShell } from '@/components/AppShell';
import { DeviceMonitoringView } from '@/components/DeviceMonitoringView';
import { useAppSession } from '@/hooks/useAppSession';

export default function MonitoringPage() {
  const { session, loading: sessionLoading } = useAppSession();

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
        <DeviceMonitoringView />
      </main>
      </AppShell>
    </div>
  );
}
