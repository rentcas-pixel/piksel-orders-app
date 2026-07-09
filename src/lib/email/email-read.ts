import type { ProcessedEmail } from '@/lib/email/types';
import type { EmailThread } from '@/lib/email/email-threading';

export function isEmailUnread(email: Pick<ProcessedEmail, 'read_at'>): boolean {
  return !email.read_at;
}

export function isThreadUnread(thread: Pick<EmailThread, 'emails' | 'latest'>): boolean {
  return isEmailUnread(thread.latest);
}
