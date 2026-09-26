'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { PlaySidebar } from '@/components/PlaySidebar';
import { usePlaySandboxState } from '@/hooks/usePlaySandboxEnabled';

interface AppShellProps {
  children: ReactNode;
  onAddOrder: () => void;
  userEmail?: string;
  className?: string;
}

function AppShellInner({ children, onAddOrder, userEmail, className }: AppShellProps) {
  const { ready: playReady, enabled: playSandbox } = usePlaySandboxState();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchParams]);

  if (!playReady) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400 ${className ?? ''}`}
      >
        Kraunama…
      </div>
    );
  }

  if (!playSandbox) {
    return (
      <div className={className}>
        <Header onAddOrder={onAddOrder} userEmail={userEmail} />
        {children}
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen ${className ?? ''}`}>
      <PlaySidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          playFrame
          onOpenMenu={() => setMenuOpen(true)}
          onAddOrder={onAddOrder}
          userEmail={userEmail}
        />
        {children}
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <Suspense
      fallback={
        <div
          className={`flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400 ${props.className ?? ''}`}
        >
          Kraunama…
        </div>
      }
    >
      <AppShellInner {...props} />
    </Suspense>
  );
}
