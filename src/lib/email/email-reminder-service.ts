import { EmailService } from '@/lib/email/email-service';
import { isReminderDue } from '@/lib/email/email-reminder';

export async function setProcessedEmailReminder(
  emailId: string,
  reminder: { remind_at: string | null; remind_note?: string | null }
) {
  const email = await EmailService.getById(emailId);
  if (!email) {
    throw new Error('Laiškas nerastas.');
  }

  if (reminder.remind_at) {
    const remindAt = new Date(reminder.remind_at);
    if (Number.isNaN(remindAt.getTime())) {
      throw new Error('Neteisinga priminimo data.');
    }
    if (remindAt.getTime() <= Date.now()) {
      throw new Error('Priminimo laikas turi būti ateityje.');
    }
  }

  return EmailService.setReminder(emailId, reminder);
}

/** Kai priminimo laikas sueina — grąžina laišką kaip neskaitytą. */
export async function reactivateDueReminders(): Promise<number> {
  return EmailService.reactivateDueReminders();
}

export async function dismissDueReminders(emailIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(emailIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const emails = await Promise.all(uniqueIds.map((id) => EmailService.getById(id)));
  await Promise.all(
    emails
      .filter((email): email is NonNullable<typeof email> => email != null && isReminderDue(email))
      .map((email) =>
        EmailService.setReminder(email.id, { remind_at: null, remind_note: null })
      )
  );
}
