'use client';

import { useEffect, useRef, useState } from 'react';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  EMAIL_REMINDER_PRESETS,
  formatReminderDate,
  isEmailSnoozed,
  toDatetimeLocalValue,
} from '@/lib/email/email-reminder';
import type { ProcessedEmail } from '@/lib/email/types';
import { modalBtnSecondary } from '@/lib/portal-ui';

interface EmailReminderPickerProps {
  email: ProcessedEmail;
  onUpdated: (email: ProcessedEmail) => void;
  disabled?: boolean;
}

export function EmailReminderPicker({ email, onUpdated, disabled = false }: EmailReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAt, setCustomAt] = useState('');
  const [note, setNote] = useState(email.remind_note ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNote(email.remind_note ?? '');
    if (email.remind_at) {
      setCustomAt(toDatetimeLocalValue(new Date(email.remind_at)));
    }
  }, [email.id, email.remind_at, email.remind_note]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const saveReminder = async (remindAt: string | null, remindNote?: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/emails/${email.id}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remind_at: remindAt,
          remind_note: remindNote ?? note,
        }),
      });
      const payload = (await response.json()) as { data?: ProcessedEmail; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Nepavyko nustatyti priminimo.');
      if (payload.data) {
        onUpdated(payload.data);
        setOpen(false);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nepavyko nustatyti priminimo.');
    } finally {
      setSaving(false);
    }
  };

  const snoozed = isEmailSnoozed(email);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || saving}
        className={`${modalBtnSecondary} inline-flex items-center gap-1.5 ${
          snoozed ? 'border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300' : ''
        }`}
      >
        <BellIcon className="w-4 h-4" />
        {snoozed ? 'Priminimas' : 'Priminti'}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full z-20 mb-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Priminti vėliau</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {snoozed && email.remind_at && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Aktyvus iki {formatReminderDate(email.remind_at)}
            </p>
          )}

          <div className="mt-3 space-y-1">
            {EMAIL_REMINDER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={saving}
                onClick={() => void saveReminder(preset.getDate().toISOString())}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Pasirinkta data
            </label>
            <input
              type="datetime-local"
              value={customAt}
              onChange={(event) => setCustomAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-950"
            />
            <button
              type="button"
              disabled={saving || !customAt}
              onClick={() => void saveReminder(new Date(customAt).toISOString())}
              className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Nustatyti
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Pastaba (nebūtina)
            </label>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Pvz. paskambinti klientui"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-950"
            />
          </div>

          {snoozed && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveReminder(null, '')}
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Pašalinti priminimą
            </button>
          )}

          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
