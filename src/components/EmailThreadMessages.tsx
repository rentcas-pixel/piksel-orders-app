'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline';
import type { ProcessedEmail } from '@/lib/email/types';
import { EmailBodyContent } from '@/lib/email/email-body-client';
import { formatAttachmentSize } from '@/lib/email/attachment-client';

interface EmailThreadMessagesProps {
  emails: ProcessedEmail[];
  mailboxAddress: string;
  activeReplyEmailId: string;
  onReply: (email: ProcessedEmail) => void;
  onForward: (email: ProcessedEmail) => void;
  onDownloadAttachment?: (emailId: string, index: number, filename: string) => void;
  downloadingAttachment?: { emailId: string; index: number } | null;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('lt-LT', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function isOwnMessage(email: ProcessedEmail, mailboxAddress: string): boolean {
  const self = mailboxAddress.trim().toLowerCase();
  return Boolean(self && email.from_address?.trim().toLowerCase() === self);
}

function getMessageLabel(email: ProcessedEmail, mailboxAddress: string): string {
  if (isOwnMessage(email, mailboxAddress)) {
    return email.from_name || mailboxAddress || 'Jūs';
  }
  return email.from_name || email.from_address || 'Nežinomas siuntėjas';
}

function getBodyPreview(email: ProcessedEmail): string {
  const isSent = email.draft_status === 'sent';
  const text = isSent
    ? email.draft_reply?.trim() || email.body_text?.trim() || ''
    : email.body_text?.trim() || email.summary?.trim() || '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '—';
  return cleaned.length > 100 ? `${cleaned.slice(0, 100)}…` : cleaned;
}

export function EmailThreadMessages({
  emails,
  mailboxAddress,
  activeReplyEmailId,
  onReply,
  onForward,
  onDownloadAttachment,
  downloadingAttachment,
}: EmailThreadMessagesProps) {
  const sorted = useMemo(
    () =>
      [...emails].sort(
        (left, right) =>
          new Date(left.received_at).getTime() - new Date(right.received_at).getTime()
      ),
    [emails]
  );

  const emailIdsKey = sorted.map((item) => item.id).join(',');

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (sorted.length <= 1) {
      setExpandedIds(new Set(sorted.map((item) => item.id)));
      return;
    }
    setExpandedIds(new Set());
  }, [emailIdsKey, sorted]);

  const collapsedCount = sorted.filter((item) => !expandedIds.has(item.id)).length;

  const expandAll = () => {
    setExpandedIds(new Set(sorted.map((item) => item.id)));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderAttachments = (item: ProcessedEmail) => {
    if (item.attachments.length === 0) return null;

    return (
      <ul className="mt-3 space-y-1">
        {item.attachments.map((attachment, index) => (
          <li
            key={`${item.id}-${attachment.filename}-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            <PaperClipIcon className="h-4 w-4 shrink-0 text-gray-400" />
            {onDownloadAttachment ? (
              <button
                type="button"
                onClick={() => onDownloadAttachment(item.id, index, attachment.filename)}
                disabled={
                  downloadingAttachment?.emailId === item.id &&
                  downloadingAttachment.index === index
                }
                className="text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              >
                {downloadingAttachment?.emailId === item.id &&
                downloadingAttachment.index === index
                  ? 'Atsisiunčiama…'
                  : attachment.filename}
              </button>
            ) : (
              <span>{attachment.filename}</span>
            )}
            <span className="text-gray-400">({formatAttachmentSize(attachment.size)})</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderActions = (item: ProcessedEmail) => (
    <footer className="mt-3 flex justify-end gap-1 border-t border-gray-100 pt-2 dark:border-gray-700">
      <button
        type="button"
        onClick={() => onReply(item)}
        title="Atsakyti"
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <ArrowUturnLeftIcon className="h-4 w-4" />
        Atsakyti
      </button>
      <button
        type="button"
        onClick={() => onForward(item)}
        title="Persiųsti"
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <ArrowRightIcon className="h-4 w-4" />
        Persiųsti
      </button>
    </footer>
  );

  const renderExpandedMessage = (
    item: ProcessedEmail,
    options?: { collapsible?: boolean }
  ) => {
    const isActiveReply = item.id === activeReplyEmailId;
    const isSent = item.draft_status === 'sent';
    const sentBody = item.draft_reply?.trim() || item.body_text?.trim() || '';
    const showSentBody = isSent && Boolean(sentBody);

    return (
      <article
        key={item.id}
        className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-800/80 ${
          isActiveReply
            ? 'border-blue-300 ring-1 ring-blue-200 dark:border-blue-700 dark:ring-blue-900/50'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {getMessageLabel(item, mailboxAddress)}
            </p>
            {item.from_address && !isOwnMessage(item, mailboxAddress) && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.from_address}</p>
            )}
            {item.to_addresses?.length ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Kam: {item.to_addresses.join(', ')}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-400">{formatDate(item.received_at)}</p>
              {isSent && (
                <p className="mt-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                  Išsiųsta
                </p>
              )}
            </div>
            {options?.collapsible && (
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                title="Suskleisti"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <ChevronUpIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {renderAttachments(item)}

        <div className="mt-3">
          {showSentBody ? (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
              {sentBody}
            </pre>
          ) : (
            <EmailBodyContent email={item} />
          )}
        </div>

        {renderActions(item)}
      </article>
    );
  };

  const renderCollapsedMessage = (item: ProcessedEmail) => {
    const isActiveReply = item.id === activeReplyEmailId;
    const isSent = item.draft_status === 'sent';

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => toggleExpanded(item.id)}
        className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-left transition hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 ${
          isActiveReply
            ? 'border-blue-300 ring-1 ring-blue-200 dark:border-blue-700 dark:ring-blue-900/50'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {getMessageLabel(item, mailboxAddress)}
              </p>
              {isSent && (
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
                  Išsiųsta
                </span>
              )}
              {item.attachments.length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                  <PaperClipIcon className="h-3 w-3" />
                  {item.attachments.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {getBodyPreview(item)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-xs text-gray-400">{formatDate(item.received_at)}</p>
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </button>
    );
  };

  if (sorted.length === 0) return null;

  if (sorted.length === 1) {
    return <div className="space-y-2">{renderExpandedMessage(sorted[0])}</div>;
  }

  return (
    <div className="space-y-2">
      {collapsedCount === sorted.length && (
        <button
          type="button"
          onClick={expandAll}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800/50"
        >
          <ChevronDownIcon className="h-3.5 w-3.5" />
          Rodyti visus {sorted.length} laiškus gijoje
        </button>
      )}

      {sorted.map((item) => (
        <Fragment key={item.id}>
          {expandedIds.has(item.id)
            ? renderExpandedMessage(item, { collapsible: true })
            : renderCollapsedMessage(item)}
        </Fragment>
      ))}
    </div>
  );
}
