import type { ProcessedEmail } from '@/lib/email/types';

export function buildForwardSubject(subject: string | null): string {
  const trimmed = (subject ?? '').trim();
  if (!trimmed) return 'Fwd:';
  return /^fwd:/i.test(trimmed) ? trimmed : `Fwd: ${trimmed}`;
}

function formatForwardDate(value: string): string {
  try {
    return new Date(value).toLocaleString('lt-LT');
  } catch {
    return value;
  }
}

function pickPlainBody(email: ProcessedEmail): string {
  if (email.draft_status === 'sent' && email.draft_reply?.trim()) {
    return email.draft_reply.trim();
  }
  const text = email.body_text?.trim();
  if (text) return text;
  const html = email.body_html?.trim();
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildForwardBody(email: ProcessedEmail): string {
  const fromLine = email.from_name
    ? `${email.from_name} <${email.from_address ?? ''}>`
    : (email.from_address ?? 'Nežinomas siuntėjas');

  const quoted = pickPlainBody(email) || '(tuščias tekstas)';

  return `\n\n---------- Persiųstas laiškas ----------\nNuo: ${fromLine}\nData: ${formatForwardDate(email.received_at)}\nTema: ${email.subject || '(be temos)'}\n\n${quoted}`;
}
