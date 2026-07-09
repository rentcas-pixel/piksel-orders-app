import type { ProcessedEmail } from '@/lib/email/types';
import type { EmailThread } from '@/lib/email/email-threading';
import { isThreadUnread } from '@/lib/email/email-read';

export interface EmailReminderPreset {
  id: string;
  label: string;
  getDate: () => Date;
}

function atLocalTime(base: Date, hours: number, minutes = 0): Date {
  const date = new Date(base);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function nextWeekday(targetDay: number, hours: number): Date {
  const date = new Date();
  const currentDay = date.getDay();
  let daysAhead = targetDay - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  date.setDate(date.getDate() + daysAhead);
  return atLocalTime(date, hours);
}

export const EMAIL_REMINDER_PRESETS: EmailReminderPreset[] = [
  {
    id: 'later_today',
    label: 'Šiandien vakare',
    getDate: () => {
      const now = new Date();
      const evening = atLocalTime(now, 18);
      if (evening.getTime() <= now.getTime()) {
        evening.setDate(evening.getDate() + 1);
        evening.setHours(9, 0, 0, 0);
      }
      return evening;
    },
  },
  {
    id: 'tomorrow',
    label: 'Rytoj',
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      return atLocalTime(date, 9);
    },
  },
  {
    id: 'in_3_days',
    label: 'Po 3 dienų',
    getDate: () => {
      const date = new Date();
      date.setDate(date.getDate() + 3);
      return atLocalTime(date, 9);
    },
  },
  {
    id: 'next_week',
    label: 'Kitą savaitę',
    getDate: () => nextWeekday(1, 9),
  },
];

export function isEmailSnoozed(email: Pick<ProcessedEmail, 'remind_at'>): boolean {
  if (!email.remind_at) return false;
  return new Date(email.remind_at).getTime() > Date.now();
}

export function isThreadSnoozed(thread: Pick<EmailThread, 'latest'>): boolean {
  return isEmailSnoozed(thread.latest);
}

/** Priminimo laikas praėjo — laiškas grįžo į gautuosius ir laukia dėmesio. */
export function isReminderDue(email: Pick<ProcessedEmail, 'remind_at'>): boolean {
  if (!email.remind_at) return false;
  return new Date(email.remind_at).getTime() <= Date.now();
}

export function isThreadReminderDue(thread: Pick<EmailThread, 'latest'>): boolean {
  return isReminderDue(thread.latest);
}

export function isThreadAttentionNeeded(
  thread: Pick<EmailThread, 'latest' | 'emails'>
): boolean {
  return isThreadUnread(thread) || isThreadReminderDue(thread);
}

export function formatReminderDate(value: string): string {
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

export function toDatetimeLocalValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
