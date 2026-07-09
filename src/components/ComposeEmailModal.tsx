'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EmailSignaturePreview } from '@/components/EmailSignaturePreview';
import { EmailAttachmentPicker } from '@/components/EmailAttachmentPicker';
import { EmailRecipientFields } from '@/components/EmailRecipientFields';
import { filesToOutgoingAttachments } from '@/lib/email/attachment-client';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

export interface ComposeEmailInitialValues {
  to?: string;
  cc?: string;
  subject?: string;
  message?: string;
}

interface ComposeEmailModalProps {
  isOpen: boolean;
  defaultFrom?: string;
  title?: string;
  initialValues?: ComposeEmailInitialValues | null;
  onClose: () => void;
  onSent?: () => void;
}

export function ComposeEmailModal({
  isOpen,
  defaultFrom,
  title = 'Naujas laiškas',
  initialValues,
  onClose,
  onSent,
}: ComposeEmailModalProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTo(initialValues?.to ?? '');
    setCc(initialValues?.cc ?? '');
    setBcc('');
    setShowCcBcc(Boolean(initialValues?.cc));
    setSubject(initialValues?.subject ?? '');
    setMessage(initialValues?.message ?? '');
    setAttachments([]);
    setError(null);
  }, [isOpen, initialValues]);

  const handleClose = () => {
    if (sending) return;
    setError(null);
    onClose();
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const outgoingAttachments = await filesToOutgoingAttachments(attachments);
      const response = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          message,
          attachments: outgoingAttachments,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Nepavyko išsiųsti.');
      }

      setTo('');
      setCc('');
      setBcc('');
      setShowCcBcc(false);
      setSubject('');
      setMessage('');
      setAttachments([]);
      onSent?.();
      onClose();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Nepavyko išsiųsti.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <div className="flex h-full w-full">
              <DialogPanel className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </DialogTitle>
                  <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {defaultFrom && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Nuo: <span className="text-gray-800 dark:text-gray-200">{defaultFrom}</span>
                    </p>
                  )}

                  <EmailRecipientFields
                    to={to}
                    cc={cc}
                    bcc={bcc}
                    onToChange={setTo}
                    onCcChange={setCc}
                    onBccChange={setBcc}
                    disabled={sending}
                    showCcBcc={showCcBcc}
                    onToggleCcBcc={() => setShowCcBcc(true)}
                    mailboxAddress={defaultFrom}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tema
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Laiško tema"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex min-h-[320px] flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tekstas
                    </label>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={16}
                      placeholder="Rašykite laišką..."
                      className="min-h-[280px] flex-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                  </div>

                  <EmailSignaturePreview />

                  <EmailAttachmentPicker
                    files={attachments}
                    onChange={setAttachments}
                    disabled={sending}
                  />

                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                  <button type="button" onClick={handleClose} disabled={sending} className={modalBtnSecondary}>
                    Atšaukti
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !to.trim() || !subject.trim() || !message.trim()}
                    className={modalBtnPrimary}
                  >
                    {sending ? 'Siunčiama…' : 'Patvirtinti ir išsiųsti'}
                  </button>
                </div>
              </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
