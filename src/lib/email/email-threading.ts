import type { EmailCategory, ProcessedEmail } from '@/lib/email/types';

export interface EmailThread {
  id: string;
  subject: string;
  emails: ProcessedEmail[];
  latest: ProcessedEmail;
  count: number;
  primaryCategory: EmailCategory;
}

const CATEGORY_PRIORITY: Record<EmailCategory, number> = {
  urgent: 5,
  needs_reply: 4,
  invoice_payment: 3,
  informational: 2,
  ignore: 1,
};

function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^<|>$/g, '').toLowerCase();
}

export function normalizeEmailSubject(subject: string | null | undefined): string {
  return (subject ?? '')
    .replace(/^(re|fw|fwd|aw|sv):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function displaySubject(subject: string | null | undefined): string {
  const trimmed = (subject ?? '').trim();
  return trimmed || '(be temos)';
}

function getEmailThreadKeys(email: ProcessedEmail): string[] {
  const keys: string[] = [];

  const messageId = normalizeMessageId(email.message_id);
  if (messageId) keys.push(`mid:${messageId}`);

  const inReplyTo = normalizeMessageId(email.in_reply_to);
  if (inReplyTo) keys.push(`mid:${inReplyTo}`);

  for (const reference of email.reference_ids ?? []) {
    const normalized = normalizeMessageId(reference);
    if (normalized) keys.push(`mid:${normalized}`);
  }

  const subjectKey = normalizeEmailSubject(email.subject);
  if (subjectKey) {
    keys.push(`subj:${subjectKey}`);
  }

  return keys.length > 0 ? keys : [`email:${email.id}`];
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(key: string): string {
    const existing = this.parent.get(key);
    if (!existing) {
      this.parent.set(key, key);
      return key;
    }
    if (existing !== key) {
      const root = this.find(existing);
      this.parent.set(key, root);
      return root;
    }
    return key;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}

function pickPrimaryCategory(emails: ProcessedEmail[]): EmailCategory {
  return emails.reduce<EmailCategory>((best, email) => {
    return CATEGORY_PRIORITY[email.category] > CATEGORY_PRIORITY[best] ? email.category : best;
  }, emails[0]?.category ?? 'informational');
}

export function buildEmailThreads(emails: ProcessedEmail[]): EmailThread[] {
  if (!emails.length) return [];

  const unionFind = new UnionFind();

  for (const email of emails) {
    const keys = getEmailThreadKeys(email);
    for (let index = 1; index < keys.length; index += 1) {
      unionFind.union(keys[0], keys[index]);
    }
  }

  const grouped = new Map<string, ProcessedEmail[]>();

  for (const email of emails) {
    const keys = getEmailThreadKeys(email);
    const root = unionFind.find(keys[0]);
    const bucket = grouped.get(root) ?? [];
    bucket.push(email);
    grouped.set(root, bucket);
  }

  const threads: EmailThread[] = [];

  for (const [root, threadEmails] of grouped) {
    const sorted = [...threadEmails].sort(
      (left, right) =>
        new Date(left.received_at).getTime() - new Date(right.received_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const subject =
      sorted.find((item) => normalizeEmailSubject(item.subject) === normalizeEmailSubject(latest.subject))
        ?.subject ?? latest.subject;

    threads.push({
      id: root,
      subject: displaySubject(subject),
      emails: sorted,
      latest,
      count: sorted.length,
      primaryCategory: pickPrimaryCategory(sorted),
    });
  }

  threads.sort(
    (left, right) =>
      new Date(right.latest.received_at).getTime() - new Date(left.latest.received_at).getTime()
  );

  return threads;
}

export function getThreadForEmail(
  emails: ProcessedEmail[],
  emailId: string
): ProcessedEmail[] {
  const threads = buildEmailThreads(emails);
  const thread = threads.find((item) => item.emails.some((email) => email.id === emailId));
  return thread?.emails ?? emails.filter((email) => email.id === emailId);
}
