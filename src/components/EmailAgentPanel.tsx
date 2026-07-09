'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ArrowPathIcon, ArchiveBoxIcon, ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { ComposeEmailModal, type ComposeEmailInitialValues } from '@/components/ComposeEmailModal';
import { EmailDetailModal } from '@/components/EmailDetailModal';
import { EmailMailboxSidebar, getMailboxFolderTitle } from '@/components/EmailMailboxSidebar';
import { FilterTabGroup } from '@/components/FilterTabGroup';
import { buildForwardBody, buildForwardSubject } from '@/lib/email/email-forward-client';
import { normalizeEmailDraftReply } from '@/lib/email/email-draft-format';
import { stripEmailSignature } from '@/lib/email/signature-client';
import {
  EMAIL_CATEGORY_COLORS,
  EMAIL_CATEGORY_LABELS,
  type EmailCategory,
  type EmailArchiveFilter,
  type EmailSyncState,
  type ProcessedEmail,
} from '@/lib/email/types';
import { buildEmailThreads } from '@/lib/email/email-threading';
import { hasRecipientAddresses } from '@/lib/email/email-addresses';
import { isEmailArchived, isEmailSent, isSentFolder } from '@/lib/email/email-folder-utils';
import { isEmailUnread, isThreadUnread } from '@/lib/email/email-read';
import {
  formatReminderDate,
  isThreadSnoozed,
  isThreadReminderDue,
  isThreadAttentionNeeded,
  isReminderDue,
} from '@/lib/email/email-reminder';
import {
  playNewEmailNotificationSound,
  unlockEmailNotificationAudio,
} from '@/lib/email/email-notification-sound';
import {
  portalCardClass,
  portalRowHoverClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
  portalToolbarClass,
} from '@/lib/portal-ui';

interface EmailAgentPanelProps {
  refreshKey?: number;
  searchQuery?: string;
}

type CategoryFilter = EmailCategory | 'all';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Visi' },
  { value: 'urgent', label: EMAIL_CATEGORY_LABELS.urgent },
  { value: 'needs_reply', label: EMAIL_CATEGORY_LABELS.needs_reply },
  { value: 'invoice_payment', label: EMAIL_CATEGORY_LABELS.invoice_payment },
  { value: 'informational', label: EMAIL_CATEGORY_LABELS.informational },
  { value: 'ignore', label: EMAIL_CATEGORY_LABELS.ignore },
];

interface WritingStyleSummary {
  style_guide: string | null;
  few_shot_count?: number;
  emails_analyzed: number;
  folders: string | null;
  updated_at: string | null;
  active: boolean;
  max_emails: number;
  folder_keys: string[];
  available?: number;
}

interface MailboxConfigSummary {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  fromName: string;
  passwordConfigured: boolean;
}

function formatEmailListDate(value: string): string {
  try {
    const date = new Date(value);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const emailDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (emailDay.getTime() === startOfToday.getTime()) {
      return date.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
    }
    if (emailDay.getTime() === startOfYesterday.getTime()) {
      return 'Vakar';
    }
    return date.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function formatEmailRecipients(email: ProcessedEmail): string {
  if (hasRecipientAddresses(email.to_addresses)) {
    return email.to_addresses!.join(', ');
  }
  if (hasRecipientAddresses(email.cc_addresses)) {
    return `Cc: ${email.cc_addresses!.join(', ')}`;
  }
  return '—';
}

function canArchiveFromList(email: ProcessedEmail, filter: EmailArchiveFilter): boolean {
  return (
    filter !== 'archived' &&
    filter !== 'sent' &&
    !isEmailArchived(email) &&
    !isSentFolder(email.folder)
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.trim().slice(0, 80);
    throw new Error(
      snippet
        ? `Serverio klaida: ${snippet}`
        : `Serverio klaida (${response.status}). Bandykite perkrauti puslapį.`
    );
  }
}

export function EmailAgentPanel({ refreshKey = 0, searchQuery = '' }: EmailAgentPanelProps) {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [syncState, setSyncState] = useState<EmailSyncState | null>(null);
  const [config, setConfig] = useState<MailboxConfigSummary | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [archiveFilter, setArchiveFilter] = useState<EmailArchiveFilter>('active');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [learningStyle, setLearningStyle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ProcessedEmail | null>(null);
  const [selectedThreadEmails, setSelectedThreadEmails] = useState<ProcessedEmail[]>([]);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTitle, setComposeTitle] = useState('Naujas laiškas');
  const [composeInitialValues, setComposeInitialValues] = useState<ComposeEmailInitialValues | null>(
    null
  );
  const [activeDraft, setActiveDraft] = useState('');
  const [unreadThreadCount, setUnreadThreadCount] = useState(0);
  const [reminderThreadCount, setReminderThreadCount] = useState(0);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());

  const openNewCompose = useCallback(() => {
    setComposeTitle('Naujas laiškas');
    setComposeInitialValues(null);
    setComposeOpen(true);
  }, []);

  const loadEmails = useCallback(async (options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set(
        'archive',
        archiveFilter === 'unread' || archiveFilter === 'reminders'
          ? 'active'
          : archiveFilter
      );

      const [emailsResponse, configResponse] = await Promise.all([
        fetch(`/api/email/emails?${params.toString()}`),
        fetch('/api/email/config'),
      ]);

      const emailsPayload = await readJsonResponse<{
        data?: ProcessedEmail[];
        syncState?: EmailSyncState;
        error?: string;
      }>(emailsResponse);
      const configPayload = await readJsonResponse<{
        config?: MailboxConfigSummary;
        syncState?: EmailSyncState;
        error?: string;
      }>(configResponse);

      setConfig(configPayload.config ?? null);

      if (!emailsResponse.ok) {
        throw new Error(emailsPayload.error || 'Nepavyko užkrauti laiškų.');
      }

      setEmails(emailsPayload.data ?? []);
      setSyncState(emailsPayload.syncState ?? configPayload.syncState ?? null);

      if (archiveFilter === 'sent') {
        const missingRecipients = (emailsPayload.data ?? []).filter(
          (email) => !hasRecipientAddresses(email.to_addresses)
        );
        if (missingRecipients.length > 0) {
          void fetch('/api/email/sent-recipients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              emails: missingRecipients.map((email) => ({
                id: email.id,
                imap_uid: email.imap_uid,
                folder: email.folder,
              })),
            }),
          })
            .then((response) => readJsonResponse<{
              recipients?: Record<string, { to_addresses: string[]; cc_addresses: string[] }>;
            }>(response))
            .then((payload) => {
              const recipients = payload.recipients;
              if (!recipients || Object.keys(recipients).length === 0) return;
              setEmails((current) =>
                current.map((email) => {
                  const resolved = recipients[email.id];
                  if (!resolved) return email;
                  return {
                    ...email,
                    to_addresses: resolved.to_addresses,
                    cc_addresses: resolved.cc_addresses,
                  };
                })
              );
            })
            .catch(() => {
              // Gavėjai užsikraus vėliau — sąrašas vis tiek rodomas.
            });
        }
      }
    } catch (loadError) {
      if (!options?.quiet) {
        setError(loadError instanceof Error ? loadError.message : 'Nepavyko užkrauti.');
      }
    } finally {
      if (!options?.quiet) {
        setLoading(false);
      }
    }
  }, [categoryFilter, searchQuery, archiveFilter]);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails, refreshKey]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/email/sync', { method: 'POST' });
      const payload = await readJsonResponse<{
        data?: { processed: number; skipped: number; errors: string[] };
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error || 'Sinchronizacija nepavyko.');
      }

      await loadEmails();

      const result = payload.data;
      if (result && result.processed > 0) {
        unlockEmailNotificationAudio();
        playNewEmailNotificationSound();
      }
      if (result) {
        const message = [
          `Apdorota: ${result.processed}`,
          result.errors.length > 0 ? `Klaidos: ${result.errors.length}` : null,
        ]
          .filter(Boolean)
          .join('. ');
        if (result.processed > 0 || result.errors.length > 0) {
          alert(message);
        }
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Sinchronizacija nepavyko.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLearnStyle = async () => {
    if (
      !confirm(
        'Perskaityti jūsų laiškus iš Sent ir Archive ir išsaugoti few-shot pavyzdžius? Tai gali užtrukti 1–2 min.'
      )
    ) {
      return;
    }

    setLearningStyle(true);
    setError(null);
    try {
      const response = await fetch('/api/email/style', { method: 'POST' });
      const payload = await readJsonResponse<{
        data?: WritingStyleSummary;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(payload.error || 'Stiliaus mokymas nepavyko.');
      }
      alert(
        payload.data
          ? payload.data.few_shot_count
            ? `Išsaugota ${payload.data.few_shot_count} few-shot pavyzdžių (iš ${payload.data.emails_analyzed} laiškų).`
            : `Few-shot pavyzdžiai išsaugoti iš ${payload.data.emails_analyzed} laiškų.`
          : 'Few-shot pavyzdžiai išsaugoti.'
      );
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : 'Stiliaus mokymas nepavyko.');
    } finally {
      setLearningStyle(false);
    }
  };

  const allThreads = useMemo(() => buildEmailThreads(emails), [emails]);

  useEffect(() => {
    if (
      archiveFilter === 'active' ||
      archiveFilter === 'unread' ||
      archiveFilter === 'reminders'
    ) {
      setUnreadThreadCount(
        allThreads.filter(
          (thread) => isThreadAttentionNeeded(thread) && !isThreadSnoozed(thread)
        ).length
      );
      setReminderThreadCount(allThreads.filter(isThreadSnoozed).length);
    }
  }, [allThreads, archiveFilter]);

  const threads = useMemo(() => {
    if (archiveFilter === 'unread') {
      return allThreads.filter(
        (thread) => isThreadAttentionNeeded(thread) && !isThreadSnoozed(thread)
      );
    }
    if (archiveFilter === 'reminders') {
      return [...allThreads.filter(isThreadSnoozed)].sort(
        (left, right) =>
          new Date(left.latest.remind_at ?? 0).getTime() -
          new Date(right.latest.remind_at ?? 0).getTime()
      );
    }
    if (archiveFilter === 'active') {
      return allThreads.filter((thread) => !isThreadSnoozed(thread));
    }
    return allThreads;
  }, [allThreads, archiveFilter]);

  const stats = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: threads.length,
      urgent: 0,
      needs_reply: 0,
      invoice_payment: 0,
      informational: 0,
      ignore: 0,
    };
    for (const thread of threads) {
      counts[thread.primaryCategory] += 1;
    }
    return counts;
  }, [threads]);

  const openThread = (threadEmails: ProcessedEmail[], email: ProcessedEmail) => {
    setSelectedThreadEmails(threadEmails);
    setSelectedEmail(email);
    setActiveDraft('');

    const unreadIds = threadEmails.filter(isEmailUnread).map((item) => item.id);
    const dueReminderIds = threadEmails.filter(isReminderDue).map((item) => item.id);
    const idsToSync = [...new Set([...unreadIds, ...dueReminderIds])];
    if (idsToSync.length === 0) return;

    void fetch('/api/email/emails/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToSync }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: ProcessedEmail[] };
        const updated = payload.data ?? [];
        if (updated.length === 0) return;

        const updatedById = new Map(updated.map((item) => [item.id, item]));
        setEmails((prev) => prev.map((item) => updatedById.get(item.id) ?? item));
        setSelectedThreadEmails((prev) =>
          prev.map((item) => updatedById.get(item.id) ?? item)
        );
        setSelectedEmail((prev) => (prev ? updatedById.get(prev.id) ?? prev : prev));
      })
      .catch(() => {
        // Skaitymo žymėjimas neturi blokuoti peržiūros.
      });
  };

  const handleEmailSaved = (updated: ProcessedEmail) => {
    setEmails((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedThreadEmails((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setSelectedEmail(updated);
    setActiveDraft(normalizeEmailDraftReply(updated, stripEmailSignature(updated.draft_reply ?? '')));
  };

  const handleDraftUpdateFromChat = (draft: string, updatedEmail?: ProcessedEmail) => {
    const email = updatedEmail ?? selectedEmail;
    if (email) {
      setActiveDraft(normalizeEmailDraftReply(email, stripEmailSignature(draft)));
    } else {
      setActiveDraft(stripEmailSignature(draft));
    }
    if (updatedEmail) handleEmailSaved(updatedEmail);
  };

  const handleArchiveFromList = async (
    email: ProcessedEmail,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    if (archivingIds.has(email.id)) return;

    setArchivingIds((prev) => new Set(prev).add(email.id));
    setError(null);

    try {
      const response = await fetch(`/api/email/emails/${email.id}/archive`, { method: 'POST' });
      const payload = await readJsonResponse<{ data?: ProcessedEmail; error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Nepavyko archyvuoti laiško.'
        );
      }

      setEmails((prev) => prev.filter((item) => item.id !== email.id));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(null);
        setSelectedThreadEmails([]);
        setActiveDraft('');
      } else {
        setSelectedThreadEmails((prev) => prev.filter((item) => item.id !== email.id));
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Nepavyko archyvuoti.');
    } finally {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(email.id);
        return next;
      });
    }
  };

  const renderArchiveButton = (email: ProcessedEmail) => {
    if (!canArchiveFromList(email, archiveFilter)) {
      return null;
    }

    const archiving = archivingIds.has(email.id);
    return (
      <button
        type="button"
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/40 dark:hover:text-violet-400 disabled:opacity-50"
        onClick={(event) => void handleArchiveFromList(email, event)}
        disabled={archiving}
        aria-label="Archyvuoti"
        title="Archyvuoti"
      >
        <ArchiveBoxIcon className={`h-4 w-4 ${archiving ? 'animate-pulse' : ''}`} />
      </button>
    );
  };

  const toggleThreadExpanded = (threadId: string) => {
    setExpandedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const configWarning =
    config && !config.passwordConfigured
      ? 'Pridėkite EMAIL_PASSWORD į .env.local failą.'
      : null;

  return (
    <div className="space-y-4">
      {configWarning && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          {configWarning}
        </p>
      )}

      <div className="flex items-start gap-4">
        <EmailMailboxSidebar
          value={archiveFilter}
          onChange={setArchiveFilter}
          accountEmail={config?.username}
          unreadCount={unreadThreadCount}
          reminderCount={reminderThreadCount}
          lastSyncedAt={syncState?.last_synced_at}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <FilterTabGroup
            label="Kategorija"
            value={categoryFilter}
            options={CATEGORY_FILTERS.map((item) => ({
              value: item.value,
              label: `${item.label}${item.value === 'all' ? ` (${stats.all})` : ''}`,
            }))}
            onChange={setCategoryFilter}
          />

          <div className={portalCardClass}>
            <div className={portalToolbarClass}>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {getMailboxFolderTitle(archiveFilter)}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {archiveFilter === 'archived'
                    ? 'Archyvuoti laiškai (Piksel + IMAP Archive aplankas serveryje)'
                    : archiveFilter === 'unread'
                      ? 'Gijos su neskaitytu paskutiniu laišku'
                      : archiveFilter === 'reminders'
                        ? 'Laiškai su aktyviu priminimu (paslėpti iš Gautųjų iki nurodyto laiko)'
                        : archiveFilter === 'sent'
                          ? 'Išsiųsti laiškai iš IMAP Sent aplanko (paskutinės 14 dienų)'
                          : 'Laiškų gijos (paskutinės 14 dienų, įskaitant perskaitytus)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncing || !!configWarning}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  title="Sinchronizuoti"
                  aria-label="Sinchronizuoti"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleLearnStyle()}
                  disabled={learningStyle || !!configWarning}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  title="Įkelti few-shot pavyzdžius iš Sent/Archive"
                  aria-label="Įkelti few-shot pavyzdžius"
                >
                  <SparklesIcon className={`h-5 w-5 ${learningStyle ? 'animate-pulse' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={openNewCompose}
                  disabled={!!configWarning}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  title="Naujas laiškas"
                  aria-label="Naujas laiškas"
                >
                  <PencilSquareIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={portalTheadClass}>
              <tr>
                <th className={portalThClass}>
                  {archiveFilter === 'sent' ? 'Kam' : 'Siuntėjas'}
                </th>
                <th className={portalThClass}>Tema</th>
                <th className={portalThClass}>Kategorija</th>
                <th className={`${portalThClass} text-right`}>Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} text-center text-gray-400`}>
                    Kraunama…
                  </td>
                </tr>
              ) : threads.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${portalTdClass} text-center text-gray-400`}>
                    {archiveFilter === 'unread'
                      ? 'Neskaitytų laiškų nėra.'
                      : archiveFilter === 'reminders'
                        ? 'Aktyvių priminimų nėra.'
                        : archiveFilter === 'sent'
                          ? 'Išsiųstų laiškų nėra. Paspauskite „Sinchronizuoti“.'
                          : 'Laiškų nerasta. Paspauskite „Sinchronizuoti“.'}
                  </td>
                </tr>
              ) : (
                threads.flatMap((thread) => {
                  const isExpanded = expandedThreadIds.has(thread.id);
                  const hasMultiple = thread.count > 1;
                  const threadUnread = isThreadUnread(thread);
                  const threadSnoozed = isThreadSnoozed(thread);
                  const threadReminderDue = isThreadReminderDue(thread);
                  const threadHighlighted = isThreadAttentionNeeded(thread);
                  const rows = [
                    <tr
                      key={thread.id}
                      className={`${portalRowHoverClass} ${
                        selectedEmail?.id === thread.latest.id
                          ? 'bg-violet-50/80 dark:bg-violet-950/20'
                          : threadReminderDue
                            ? 'bg-amber-50/90 dark:bg-amber-950/25 border-l-2 border-l-amber-400'
                            : threadUnread
                              ? 'bg-white dark:bg-gray-950'
                              : ''
                      }`}
                      onClick={() => openThread(thread.emails, thread.latest)}
                    >
                      <td className={`${portalTdClass} max-w-[200px] truncate`}>
                        <div className="flex items-center gap-1 min-w-0">
                          {renderArchiveButton(thread.latest)}
                          {hasMultiple ? (
                            <button
                              type="button"
                              className="shrink-0 text-gray-400 hover:text-gray-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleThreadExpanded(thread.id);
                              }}
                              aria-label={isExpanded ? 'Suskleisti giją' : 'Išskleisti giją'}
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="w-4 h-4" />
                              ) : (
                                <ChevronRightIcon className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span
                            className={`shrink-0 w-2 h-2 rounded-full ${
                              threadReminderDue
                                ? 'bg-amber-500'
                                : threadUnread
                                  ? 'bg-blue-500'
                                  : 'bg-transparent'
                            }`}
                            aria-hidden
                          />
                          <span
                            className={`truncate ${
                              threadHighlighted && archiveFilter !== 'sent'
                                ? 'font-semibold text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {archiveFilter === 'sent'
                              ? formatEmailRecipients(thread.latest)
                              : thread.latest.from_name || thread.latest.from_address || '—'}
                          </span>
                        </div>
                      </td>
                      <td className={`${portalTdClass} max-w-[320px]`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`truncate ${
                              threadHighlighted
                                ? 'font-medium text-gray-900 dark:text-gray-100'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {thread.subject}
                          </span>
                          {threadReminderDue && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              Priminimas
                            </span>
                          )}
                          {hasMultiple && (
                            <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                              {thread.count}
                            </span>
                          )}
                          {thread.latest.draft_status === 'sent' && (
                            <span className="shrink-0 text-[10px] font-medium text-green-600 dark:text-green-400">
                              Išsiųsta
                            </span>
                          )}
                          {(threadSnoozed || threadReminderDue) && thread.latest.remind_note && (
                            <span className="shrink-0 truncate max-w-[140px] text-[10px] text-amber-700 dark:text-amber-300">
                              {thread.latest.remind_note}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={portalTdClass}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${EMAIL_CATEGORY_COLORS[thread.primaryCategory]}`}
                        >
                          {EMAIL_CATEGORY_LABELS[thread.primaryCategory]}
                        </span>
                      </td>
                      <td className={`${portalTdClass} whitespace-nowrap text-right ${
                        threadHighlighted
                          ? 'font-medium text-gray-800 dark:text-gray-200'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {archiveFilter === 'reminders' && thread.latest.remind_at
                          ? formatReminderDate(thread.latest.remind_at)
                          : formatEmailListDate(thread.latest.received_at)}
                      </td>
                    </tr>,
                  ];

                  if (hasMultiple && isExpanded) {
                    for (const email of [...thread.emails].reverse().slice(1)) {
                      const emailUnread = isEmailUnread(email);
                      rows.push(
                        <tr
                          key={`${thread.id}-${email.id}`}
                          className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/50 ${
                            selectedEmail?.id === email.id
                              ? 'bg-violet-50/80 dark:bg-violet-950/20'
                              : 'bg-gray-50/80 dark:bg-gray-900/30'
                          }`}
                          onClick={() => openThread(thread.emails, email)}
                        >
                          <td className={`${portalTdClass} max-w-[200px] truncate pl-10`}>
                            <div className="flex items-center gap-1 min-w-0">
                              {renderArchiveButton(email)}
                              <span
                                className={`shrink-0 w-2 h-2 rounded-full ${
                                  emailUnread ? 'bg-blue-500' : 'bg-transparent'
                                }`}
                                aria-hidden
                              />
                              <span
                                className={`truncate ${
                                  emailUnread && archiveFilter !== 'sent'
                                    ? 'font-semibold text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {archiveFilter === 'sent'
                                  ? formatEmailRecipients(email)
                                  : email.from_name || email.from_address || '—'}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`${portalTdClass} max-w-[320px] truncate ${
                              emailUnread
                                ? 'font-medium text-gray-800 dark:text-gray-200'
                                : 'text-gray-500 dark:text-gray-300'
                            }`}
                          >
                            {email.subject || '(be temos)'}
                          </td>
                          <td className={portalTdClass}>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${EMAIL_CATEGORY_COLORS[email.category]}`}
                            >
                              {EMAIL_CATEGORY_LABELS[email.category]}
                            </span>
                          </td>
                          <td className={`${portalTdClass} whitespace-nowrap text-right ${
                            emailUnread
                              ? 'font-medium text-gray-700 dark:text-gray-200'
                              : 'text-gray-500'
                          }`}>
                            {formatEmailListDate(email.received_at)}
                          </td>
                        </tr>
                      );
                    }
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
      </div>

      <ComposeEmailModal
        isOpen={composeOpen}
        title={composeTitle}
        initialValues={composeInitialValues}
        defaultFrom={config?.username}
        onClose={() => {
          setComposeOpen(false);
          setComposeInitialValues(null);
          setComposeTitle('Naujas laiškas');
        }}
      />

      {selectedEmail && (
        <EmailDetailModal
          layout="fullscreen"
          email={selectedEmail}
          threadEmails={selectedThreadEmails}
          draftReply={activeDraft}
          onDraftChange={setActiveDraft}
          isOpen
          onClose={() => {
            setSelectedEmail(null);
            setSelectedThreadEmails([]);
            setActiveDraft('');
          }}
          onSaved={handleEmailSaved}
          onSelectThreadEmail={(threadEmail) => {
            setSelectedEmail(threadEmail);
          }}
          onArchived={(archived) => {
            setEmails((prev) => prev.filter((item) => item.id !== archived.id));
            setSelectedEmail(null);
            setSelectedThreadEmails([]);
            setActiveDraft('');
          }}
          onAgentDraftUpdate={handleDraftUpdateFromChat}
          mailboxAddress={config?.username}
          onForward={(message) => {
            setComposeTitle('Persiųsti laišką');
            setComposeInitialValues({
              subject: buildForwardSubject(message.subject),
              message: buildForwardBody(message),
            });
            setComposeOpen(true);
          }}
        />
      )}
    </div>
  );
}
