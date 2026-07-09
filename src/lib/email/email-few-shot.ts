import { getEmailBodyForAi } from '@/lib/email/email-body-utils';
import type { FewShotExample, ProcessedEmail, SimilarPastReply } from '@/lib/email/types';
import type { ReplyLanguage } from '@/lib/email/email-language';

export const FEW_SHOT_MAX_EXAMPLES = 5;
export const FEW_SHOT_MAX_BODY_LENGTH = 900;
export const FEW_SHOT_CORPUS_SIZE = 20;

export interface StoredFewShotExample {
  subject: string | null;
  body: string;
  date: string;
  folder: string;
}

export interface FewShotCorpus {
  version: 1;
  examples: StoredFewShotExample[];
}

const FEW_SHOT_CORPUS_PREFIX = '__FEW_SHOT_V1__';

export function normalizeFewShotBody(
  text: string,
  maxLength = FEW_SHOT_MAX_BODY_LENGTH
): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function normalizeSubjectKey(subject: string | null | undefined): string {
  return (subject ?? '')
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function bodyFingerprint(body: string): string {
  return body.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function dedupeFewShotExamples(examples: FewShotExample[]): FewShotExample[] {
  const seenSubjects = new Set<string>();
  const seenBodies = new Set<string>();
  const result: FewShotExample[] = [];

  for (const example of examples) {
    const subjectKey = normalizeSubjectKey(example.subject);
    const bodyKey = bodyFingerprint(example.body);
    if (subjectKey && seenSubjects.has(subjectKey)) continue;
    if (bodyKey.length > 40 && seenBodies.has(bodyKey)) continue;
    if (subjectKey) seenSubjects.add(subjectKey);
    if (bodyKey.length > 40) seenBodies.add(bodyKey);
    result.push(example);
  }

  return result;
}

export function selectFewShotExamples(
  examples: FewShotExample[],
  max = FEW_SHOT_MAX_EXAMPLES
): FewShotExample[] {
  return dedupeFewShotExamples(
    [...examples].sort((left, right) => left.priority - right.priority)
  ).slice(0, max);
}

export function pickCorpusExamplesFromSamples(
  samples: Array<{ subject: string | null; date: Date; bodyText: string; folder: string }>,
  max = FEW_SHOT_CORPUS_SIZE
): StoredFewShotExample[] {
  const sorted = [...samples].sort(
    (left, right) => right.date.getTime() - left.date.getTime()
  );
  const picked: StoredFewShotExample[] = [];
  const seenSubjects = new Set<string>();
  const seenBodies = new Set<string>();

  for (const sample of sorted) {
    if (picked.length >= max) break;

    const subjectKey = normalizeSubjectKey(sample.subject);
    const bodyKey = bodyFingerprint(sample.bodyText);
    if (subjectKey && seenSubjects.has(subjectKey)) continue;
    if (bodyKey.length > 40 && seenBodies.has(bodyKey)) continue;

    if (subjectKey) seenSubjects.add(subjectKey);
    if (bodyKey.length > 40) seenBodies.add(bodyKey);

    picked.push({
      subject: sample.subject,
      body: normalizeFewShotBody(sample.bodyText, 1200),
      date: sample.date.toISOString(),
      folder: sample.folder,
    });
  }

  return picked;
}

export function serializeFewShotCorpus(corpus: FewShotCorpus): string {
  return `${FEW_SHOT_CORPUS_PREFIX}\n${JSON.stringify(corpus)}`;
}

export function parseFewShotCorpus(raw: string | null | undefined): FewShotCorpus | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const jsonText = trimmed.startsWith(FEW_SHOT_CORPUS_PREFIX)
    ? trimmed.slice(FEW_SHOT_CORPUS_PREFIX.length).trim()
    : trimmed.startsWith('{')
      ? trimmed
      : null;

  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as FewShotCorpus;
    if (parsed.version !== 1 || !Array.isArray(parsed.examples)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function examplesFromThreadMessages(
  threadMessages: Array<{
    received_at: string;
    subject: string | null;
    body: string;
    is_self: boolean;
  }>
): FewShotExample[] {
  return threadMessages
    .filter((message) => message.is_self && message.body.trim().length > 15)
    .map((message) => ({
      source: 'thread' as const,
      subject: message.subject,
      body: normalizeFewShotBody(message.body, 1500),
      date: message.received_at,
      priority: 1,
    }));
}

export function examplesFromSimilarReplies(similarReplies: SimilarPastReply[]): FewShotExample[] {
  return similarReplies
    .filter((item) => item.reply_text.trim().length > 15)
    .slice(0, 4)
    .map((item, index) => ({
      source: 'similar' as const,
      subject: item.subject,
      body: normalizeFewShotBody(item.reply_text),
      date: undefined,
      similarity: item.similarity,
      priority: 30 + index,
    }));
}

export function examplesFromStoredCorpus(corpus: FewShotCorpus | null): FewShotExample[] {
  if (!corpus) return [];

  return corpus.examples.map((example, index) => ({
    source: 'corpus' as const,
    subject: example.subject,
    body: normalizeFewShotBody(example.body),
    date: example.date,
    priority: 50 + index,
  }));
}

export function getSentMessageBody(email: ProcessedEmail): string {
  const draft = email.draft_reply?.trim();
  if (draft) return draft;
  return getEmailBodyForAi(email.body_text, email.body_html);
}

export function examplesFromSentEmails(
  emails: ProcessedEmail[],
  source: 'recipient' | 'domain',
  priority: number
): FewShotExample[] {
  const result: FewShotExample[] = [];

  for (const email of emails) {
    const body = getSentMessageBody(email);
    if (body.trim().length < 15) continue;

    result.push({
      source,
      subject: email.subject,
      body: normalizeFewShotBody(body),
      date: email.sent_at ?? email.received_at,
      recipient: email.to_addresses?.[0] ?? undefined,
      priority,
    });
  }

  return result;
}

export function buildFewShotSystemInstruction(
  language: ReplyLanguage,
  exampleCount: number
): string {
  if (exampleCount === 0) {
    return language === 'lt'
      ? 'Few-shot pavyzdžių nėra — laikykis rašymo principų, bet rašyk natūraliai kaip Renatas.'
      : 'No few-shot examples available — follow the writing principles and sound like Renatas.';
  }

  return language === 'lt'
    ? `SVARBIAUSIA: imituok žemiau pateiktus ${exampleCount} tikrus Renato laiškus. Nukopijuok toną, kreipinį, ilgį, frazes ir struktūrą — ne tik „principus“. Jei pavyzdžiuose rašoma „Labas Vyteni,“ — naudok panašų kreipinį. Jei pavyzdžiai trumpi — rašyk trumpai.`
    : `MOST IMPORTANT: imitate the ${exampleCount} real Renatas emails below. Copy tone, greeting, length, phrasing, and structure — not just abstract rules.`;
}

export function formatFewShotBlockForPrompt(
  examples: FewShotExample[],
  language: ReplyLanguage
): string {
  if (examples.length === 0) return '';

  const header =
    language === 'lt'
      ? '## TIKRI RENATO LAIŠKAI (IMITUOK ŠITUS)'
      : '## REAL RENATAS EMAILS (IMITATE THESE)';

  const blocks = examples.map((example, index) => {
    const meta: string[] = [`Šaltinis: ${example.source}`];
    if (example.date) meta.push(`Data: ${example.date.slice(0, 10)}`);
    if (example.similarity != null) {
      meta.push(`Panašumas: ${(example.similarity * 100).toFixed(0)}%`);
    }
    if (example.recipient) meta.push(`Kam: ${example.recipient}`);

    return `### Pavyzdys ${index + 1}
${meta.join(' | ')}
Tema: ${example.subject ?? '(be temos)'}

${example.body}`;
  });

  return `${header}

${blocks.join('\n\n')}`;
}

export function formatFewShotSourceLabel(source: FewShotExample['source'], language: ReplyLanguage): string {
  const labelsLt: Record<FewShotExample['source'], string> = {
    thread: 'ši gija',
    recipient: 'tas pats gavėjas',
    domain: 'ta pati įmonė',
    similar: 'panaši tema',
    corpus: 'bendras stilius',
  };
  const labelsEn: Record<FewShotExample['source'], string> = {
    thread: 'this thread',
    recipient: 'same recipient',
    domain: 'same company',
    similar: 'similar topic',
    corpus: 'general style',
  };
  return language === 'lt' ? labelsLt[source] : labelsEn[source];
}
