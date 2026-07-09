'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { SparklesIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import {
  EMAIL_CATEGORY_COLORS,
  EMAIL_CATEGORY_LABELS,
  type ProcessedEmail,
} from '@/lib/email/types';
import { EmailSignaturePreview } from '@/components/EmailSignaturePreview';
import { EmailAttachmentPicker } from '@/components/EmailAttachmentPicker';
import { EmailThreadMessages } from '@/components/EmailThreadMessages';
import { stripEmailSignature } from '@/lib/email/signature-client';
import { normalizeEmailDraftReply } from '@/lib/email/email-draft-format';
import {
  filesToOutgoingAttachments,
  downloadEmailAttachment,
} from '@/lib/email/attachment-client';
import { isEmailArchived, isSentFolder } from '@/lib/email/email-folder-utils';
import { EmailAgentChat } from '@/components/EmailAgentChat';
import { EmailRecipientFields } from '@/components/EmailRecipientFields';
import { EmailReminderPicker } from '@/components/EmailReminderPicker';
import { formatReminderDate, isEmailSnoozed, isReminderDue } from '@/lib/email/email-reminder';
import { buildReplyRecipients } from '@/lib/email/email-addresses';
import { modalBtnDanger, modalBtnPrimary, modalBtnSecondary, portalCardClass } from '@/lib/portal-ui';

interface EmailDetailModalProps {
  email: ProcessedEmail | null;
  threadEmails?: ProcessedEmail[];
  draftReply?: string;
  onDraftChange?: (draft: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (email: ProcessedEmail) => void;
  onSelectThreadEmail?: (email: ProcessedEmail) => void;
  onArchived?: (email: ProcessedEmail) => void;
  layout?: 'modal' | 'panel' | 'fullscreen';
  onAgentDraftUpdate?: (draft: string, email?: ProcessedEmail) => void;
  mailboxAddress?: string;
  onForward?: (email: ProcessedEmail) => void;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('lt-LT');
  } catch {
    return value;
  }
}

export function EmailDetailModal({
  email,
  threadEmails = [],
  draftReply: controlledDraft,
  onDraftChange,
  isOpen,
  onClose,
  onSaved,
  onSelectThreadEmail,
  onArchived,
  layout = 'modal',
  onAgentDraftUpdate,
  mailboxAddress = '',
  onForward,
}: EmailDetailModalProps) {
  const draftSectionRef = useRef<HTMLDivElement>(null);
  const [internalDraft, setInternalDraft] = useState('');
  const draftReply = controlledDraft ?? internalDraft;
  const setDraftReply = onDraftChange ?? setInternalDraft;
  const [replyTo, setReplyTo] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [downloadingAttachment, setDownloadingAttachment] = useState<{
    emailId: string;
    index: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controlledDraft === undefined) {
      setInternalDraft('');
    }
    if (email) {
      const recipients = buildReplyRecipients(email, mailboxAddress, 'reply');
      setReplyTo(recipients.to);
      setReplyCc(recipients.cc);
      setReplyBcc('');
      setShowCcBcc(Boolean(recipients.cc));
    }
    setReplyAttachments([]);
    setShowInsights(false);
    setError(null);
  }, [email, controlledDraft, mailboxAddress]);

  if (!email) return null;

  const isSentItem = isSentFolder(email.folder) || email.draft_status === 'sent';

  const canSend =
    !isSentItem &&
    email.draft_status !== 'sent' &&
    draftReply.trim().length > 0 &&
    replyTo.trim().length > 0;

  const applyReplyMode = (mode: 'reply' | 'reply-all', target = email) => {
    const recipients = buildReplyRecipients(target, mailboxAddress, mode);
    setReplyTo(recipients.to);
    setReplyCc(recipients.cc);
    if (recipients.cc) setShowCcBcc(true);
  };

  const handleReplyToMessage = (message: ProcessedEmail) => {
    onSelectThreadEmail?.(message);
    applyReplyMode('reply', message);
    setReplyBcc('');
    setShowCcBcc(Boolean(buildReplyRecipients(message, mailboxAddress, 'reply').cc));
    draftSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleForwardToMessage = (message: ProcessedEmail) => {
    onForward?.(message);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/emails/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_reply: draftReply }),
      });
      const payload = (await response.json()) as { data?: ProcessedEmail; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Nepavyko išsaugoti.');
      if (payload.data) onSaved(payload.data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nepavyko išsaugoti.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDraft = async () => {
    setGeneratingDraft(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/emails/${email.id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadEmails: threadContext,
          mailboxAddress,
        }),
      });
      const payload = (await response.json()) as {
        data?: ProcessedEmail;
        generation?: {
          draft_reply: string;
          summary: string;
          suggested_action: string;
          confidence: string;
          missing_information: string[];
        };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Nepavyko sugeneruoti atsakymo.');
      if (payload.data) {
        setDraftReply(
          normalizeEmailDraftReply(email, stripEmailSignature(payload.data.draft_reply ?? ''))
        );
        onSaved(payload.data);
      }
      if (payload.generation?.missing_information?.length) {
        setError(
          `Trūksta info: ${payload.generation.missing_information.join('; ')} (pasitikėjimas: ${payload.generation.confidence})`
        );
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Nepavyko sugeneruoti atsakymo.');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const attachments = await filesToOutgoingAttachments(replyAttachments);
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          replyText: draftReply,
          to: replyTo,
          cc: replyCc || undefined,
          bcc: replyBcc || undefined,
          attachments,
        }),
      });
      const payload = (await response.json()) as { data?: ProcessedEmail; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Nepavyko išsiųsti.');
      if (payload.data) {
        setDraftReply(normalizeEmailDraftReply(email, stripEmailSignature(draftReply)));
        onSaved(payload.data);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Nepavyko išsiųsti.');
    } finally {
      setSending(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/emails/${email.id}/archive`, { method: 'POST' });
      const payload = (await response.json()) as { data?: ProcessedEmail; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Nepavyko archyvuoti.');
      if (payload.data) {
        onArchived?.(payload.data);
        onClose();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Nepavyko archyvuoti.');
    } finally {
      setArchiving(false);
    }
  };

  const handleDownloadAttachment = async (emailId: string, index: number, filename: string) => {
    setDownloadingAttachment({ emailId, index });
    setError(null);
    try {
      await downloadEmailAttachment(emailId, index, filename);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Nepavyko atsisiųsti priedo.'
      );
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const isPanel = layout === 'panel' || layout === 'fullscreen';
  const isFullscreen = layout === 'fullscreen';
  const threadContext = threadEmails.length ? threadEmails : [email];
  const agentDisabled = isSentItem;
  const hasInsights =
    email.draft_status !== 'sent' &&
    Boolean(email.summary || email.importance_reason || email.recommended_action);

  const header = (
    <div
      className={`flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 ${
        isPanel ? 'px-4 py-3' : 'px-6 py-4'
      }`}
    >
      <div className="min-w-0">
        {isPanel ? (
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {email.subject || '(be temos)'}
          </h2>
        ) : (
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {email.subject || '(be temos)'}
          </DialogTitle>
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {email.from_name || email.from_address || 'Nežinomas siuntėjas'}
          {email.from_address ? ` <${email.from_address}>` : ''}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(email.received_at)}</p>
      </div>
      <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  );

  const emailContent = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${EMAIL_CATEGORY_COLORS[email.category]}`}
        >
          {EMAIL_CATEGORY_LABELS[email.category]}
        </span>
        {threadContext.length > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Gija · {threadContext.length}
          </span>
        )}
        {email.draft_status === 'sent' && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
            Išsiųsta {email.sent_at ? formatDate(email.sent_at) : ''}
          </span>
        )}
        {isEmailArchived(email) && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Archyvuota {email.archived_at ? formatDate(email.archived_at) : ''}
            {email.folder && email.folder.toUpperCase() !== 'INBOX'
              ? ` · IMAP: ${email.folder}`
              : ''}
          </span>
        )}
        {isEmailSnoozed(email) && email.remind_at && (
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            Priminimas: {formatReminderDate(email.remind_at)}
            {email.remind_note ? ` · ${email.remind_note}` : ''}
          </span>
        )}
        {isReminderDue(email) && (
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            Priminimo laikas — laiškas grįžo į gautuosius
            {email.remind_note ? ` · ${email.remind_note}` : ''}
          </span>
        )}
      </div>

      {email.draft_status !== 'sent' && hasInsights && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowInsights((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
          >
            <span>AI įžvalgos</span>
            {showInsights ? (
              <ChevronUpIcon className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 shrink-0" />
            )}
          </button>
          {showInsights && (
            <div className="space-y-3 border-t border-gray-200 px-3 py-3 dark:border-gray-700">
              {email.summary && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Santrauka</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{email.summary}</p>
                </div>
              )}
              {email.importance_reason && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Kodėl svarbu</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{email.importance_reason}</p>
                </div>
              )}
              {email.recommended_action && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Rekomenduojamas veiksmas</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{email.recommended_action}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {threadContext.length > 1 && (
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Gijos istorija · {threadContext.length} laiškai
        </p>
      )}

      <EmailThreadMessages
        emails={threadContext}
        mailboxAddress={mailboxAddress}
        activeReplyEmailId={email.id}
        onReply={handleReplyToMessage}
        onForward={handleForwardToMessage}
        onDownloadAttachment={(emailId, index, filename) =>
          void handleDownloadAttachment(emailId, index, filename)
        }
        downloadingAttachment={downloadingAttachment}
      />
    </>
  );

  const draftSection = (
    <div
      ref={draftSectionRef}
      className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {email.draft_status === 'sent' ? 'Išsiųstas atsakymas' : 'Atsakymas'}
        </h3>
        {!isEmailArchived(email) && email.draft_status !== 'sent' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateDraft()}
              disabled={generatingDraft || sending || saving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                draftReply.trim()
                  ? 'border border-gray-300 text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900/50'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              <SparklesIcon className={`h-4 w-4 ${generatingDraft ? 'animate-pulse' : ''}`} />
              {generatingDraft ? 'Rašoma…' : 'AI pagalba'}
            </button>
            <button
              type="button"
              onClick={() => applyReplyMode('reply')}
              disabled={generatingDraft || sending || saving}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900/50 disabled:opacity-50"
            >
              Tik siuntėjui
            </button>
            <button
              type="button"
              onClick={() => applyReplyMode('reply-all')}
              disabled={generatingDraft || sending || saving}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900/50 disabled:opacity-50"
            >
              Visiems
            </button>
          </div>
        )}
      </div>
      {email.draft_status !== 'sent' && !isEmailArchived(email) && (
        <div className="mt-3">
          <EmailRecipientFields
            to={replyTo}
            cc={replyCc}
            bcc={replyBcc}
            onToChange={setReplyTo}
            onCcChange={setReplyCc}
            onBccChange={setReplyBcc}
            disabled={sending || saving || generatingDraft}
            showCcBcc={showCcBcc}
            onToggleCcBcc={() => setShowCcBcc(true)}
            mailboxAddress={mailboxAddress}
          />
        </div>
      )}
      <textarea
        value={draftReply}
        onChange={(event) => setDraftReply(event.target.value)}
        disabled={email.draft_status === 'sent' || generatingDraft}
        rows={isFullscreen ? 10 : isPanel ? 6 : 8}
        placeholder="Tavo atsakymas…"
        className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
      {email.draft_status !== 'sent' && <EmailSignaturePreview />}
      {!isEmailArchived(email) && email.draft_status !== 'sent' && (
        <div className="mt-3">
          <EmailAttachmentPicker
            files={replyAttachments}
            onChange={setReplyAttachments}
            disabled={sending || saving || generatingDraft}
          />
        </div>
      )}
    </div>
  );

  const footer = (
    <div
      className={`flex flex-wrap justify-between gap-2 border-t border-gray-200 dark:border-gray-700 ${
        isPanel ? 'px-4 py-3' : 'px-6 py-4'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isEmailArchived(email) && !isSentFolder(email.folder) && (
          <EmailReminderPicker
            email={email}
            onUpdated={onSaved}
            disabled={archiving || sending || saving}
          />
        )}
        {!isEmailArchived(email) && !isSentFolder(email.folder) && (
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={archiving || sending || saving}
            className={modalBtnSecondary}
          >
            {archiving ? 'Archyvuojama…' : 'Archyvuoti'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {!isPanel && (
          <button type="button" onClick={onClose} className={modalBtnSecondary}>
            Uždaryti
          </button>
        )}
        {!isEmailArchived(email) && email.draft_status !== 'sent' && (
          <>
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={saving || !draftReply.trim()}
              className={modalBtnSecondary}
            >
              {saving ? 'Saugoma…' : 'Išsaugoti juodraštį'}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend || sending}
              className={modalBtnPrimary}
            >
              {sending ? 'Siunčiama…' : 'Patvirtinti ir išsiųsti'}
            </button>
          </>
        )}
        {email.draft_status === 'sent' && !isEmailArchived(email) && (
          <span className={`${modalBtnDanger} opacity-60 cursor-default`}>Laiškas jau išsiųstas</span>
        )}
      </div>
    </div>
  );

  const agentChat = (
    <EmailAgentChat
      variant={isPanel ? 'embedded' : 'inline'}
      emailId={email.id}
      emailSubject={email.subject}
      threadEmails={threadContext}
      currentDraft={draftReply}
      mailboxAddress={mailboxAddress}
      disabled={agentDisabled}
      onDraftUpdate={onAgentDraftUpdate}
    />
  );

  const panelBody = (
    <div className={`${portalCardClass} flex h-full w-full flex-col overflow-hidden`}>
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!isSentFolder(email.folder) && draftSection}
          {emailContent}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="hidden min-h-0 w-[min(380px,34%)] shrink-0 border-l border-gray-200 p-3 dark:border-gray-700 md:flex md:flex-col">
          {agentChat}
        </div>
      </div>
      {footer}
    </div>
  );

  const modalBody = (
    <>
      {header}
      <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {!isSentFolder(email.folder) && draftSection}
        {emailContent}
        {agentChat}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      {footer}
    </>
  );

  if (isPanel && !isFullscreen) {
    if (!isOpen) return null;
    return panelBody;
  }

  if (isFullscreen) {
    return (
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-hidden p-3 sm:p-4">
            <div className="flex h-full w-full">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-[0.99]"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-[0.99]"
              >
                <DialogPanel className="flex h-full w-full max-w-none flex-col overflow-hidden">
                  {panelBody}
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
                {modalBody}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
