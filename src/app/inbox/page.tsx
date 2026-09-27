'use client';
import { AppShell } from '@/components/AppShell';
import { PlayInbox } from '@/components/PlayInbox';
import { useAppSession } from '@/hooks/useAppSession';
export default function InboxPage() {
  const { session, loading } = useAppSession();
  if (loading) return <p className="p-8">Kraunama…</p>;
  if (!session || session.role !== 'admin') return <main className="p-8"><p>Inbox prieinamas administratoriui.</p><a href="/login">Prisijungti</a></main>;
  return <AppShell onAddOrder={() => {}} userEmail={session.email}><PlayInbox /></AppShell>;
}
