import { getEmailBodyForAi } from '@/lib/email/email-body-utils';
import {
  extractEmailDomain,
  guessCompanyNameFromDomain,
  isCompanyDomain,
} from '@/lib/email/email-domain-utils';
import { findSimilarSentReplies } from '@/lib/email/email-embeddings-service';
import { detectReplyLanguage } from '@/lib/email/email-language';
import { getThreadForEmail } from '@/lib/email/email-threading';
import { getWritingVoiceRules } from '@/lib/email/email-writing-voice';
import { getWritingStylePrompt } from '@/lib/email/email-style-service';
import { EmailService } from '@/lib/email/email-service';
import type { EmailContextPackage, EmailContextStrength, ProcessedEmail } from '@/lib/email/types';

function truncateText(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function isSelfMessage(email: ProcessedEmail, mailboxAddress: string): boolean {
  const self = mailboxAddress.trim().toLowerCase();
  return Boolean(self && email.from_address?.trim().toLowerCase() === self);
}

function buildCompanyRelationshipSummary(emails: ProcessedEmail[]): string {
  if (emails.length === 0) return 'Ankstesnių laiškų iš šio domeno nerasta.';

  return emails
    .slice(0, 12)
    .map((email) => {
      const date = email.received_at.slice(0, 10);
      const subject = email.subject || '(be temos)';
      const summary = email.summary?.trim() || truncateText(email.body_text, 120);
      return `- ${date} | ${subject} | ${summary}`;
    })
    .join('\n');
}

function buildOpenTopics(emails: ProcessedEmail[]): string {
  const open = emails.filter(
    (email) =>
      email.category === 'needs_reply' ||
      email.category === 'urgent' ||
      email.category === 'invoice_payment'
  );

  if (open.length === 0) {
    return 'Akivaizdžių atvirų temų pagal kategorijas nerasta.';
  }

  return open
    .slice(0, 6)
    .map((email) => `- ${email.subject || '(be temos)'} (${email.category})`)
    .join('\n');
}

function assessContextStrength(input: {
  threadCount: number;
  companyEmailCount: number;
  similarCount: number;
  bodyLength: number;
}): { strength: EmailContextStrength; gaps: string[] } {
  const gaps: string[] = [];
  let score = 0;

  if (input.bodyLength > 80) score += 2;
  else gaps.push('Dabartinio laiško turinys labai trumpas arba tuščias.');

  if (input.threadCount > 1) score += 2;
  else gaps.push('Gijos istorija nerasta — kontekstas tik iš vieno laiško.');

  if (input.companyEmailCount >= 3) score += 2;
  else if (input.companyEmailCount === 0) gaps.push('Nėra ankstesnės istorijos su šiuo domenu.');
  else gaps.push('Mažai ankstesnių laiškų iš kliento domeno.');

  if (input.similarCount >= 3) score += 2;
  else gaps.push('Nerasta panašių ankstesnių tavo atsakymų (pgvector).');

  const strength: EmailContextStrength =
    score >= 6 ? 'strong' : score >= 3 ? 'moderate' : 'weak';

  return { strength, gaps };
}

export async function buildEmailContextPackage(
  email: ProcessedEmail,
  options?: {
    threadEmails?: ProcessedEmail[];
    mailboxAddress?: string;
  }
): Promise<EmailContextPackage> {
  const mailboxAddress = options?.mailboxAddress?.trim() || '';
  const body = getEmailBodyForAi(email.body_text, email.body_html);
  const replyLanguage = detectReplyLanguage(email.subject, body);

  let threadEmails = options?.threadEmails;
  if (!threadEmails || threadEmails.length <= 1) {
    const pool = await EmailService.listRecentForThreading(400);
    threadEmails = getThreadForEmail(pool, email.id);
  }

  const sortedThread = [...threadEmails].sort(
    (left, right) => new Date(right.received_at).getTime() - new Date(left.received_at).getTime()
  );

  const threadMessages = sortedThread.map((item) => ({
    received_at: item.received_at,
    author: isSelfMessage(item, mailboxAddress)
      ? 'Tu (Renatas)'
      : item.from_name || item.from_address || 'Nežinomas',
    is_self: isSelfMessage(item, mailboxAddress),
    subject: item.subject,
    body: truncateText(
      getEmailBodyForAi(item.body_text, item.body_html),
      item.id === email.id ? 6000 : 1500
    ),
  }));

  const domain = extractEmailDomain(email.from_address);
  let companyContext: EmailContextPackage['companyContext'] = null;

  if (domain && isCompanyDomain(domain)) {
    const companyEmails = await EmailService.listBySenderDomain(domain, {
      excludeId: email.id,
      limit: 25,
    });
    companyContext = {
      domain,
      company_name: guessCompanyNameFromDomain(domain),
      email_count: companyEmails.length,
      relationship_summary: buildCompanyRelationshipSummary(companyEmails),
      open_topics: buildOpenTopics(companyEmails),
      recent_subjects: companyEmails
        .slice(0, 8)
        .map((item) => item.subject || '(be temos)'),
    };
  }

  const similarQuery = [
    `Subject: ${email.subject ?? ''}`,
    `From: ${email.from_name ?? ''} <${email.from_address ?? ''}>`,
    body.slice(0, 3000),
  ].join('\n');

  let similarReplies = await findSimilarSentReplies(similarQuery, 8);
  if (similarReplies.length === 0) {
    const { backfillSentReplyEmbeddings } = await import('@/lib/email/email-embeddings-service');
    await backfillSentReplyEmbeddings(30);
    similarReplies = await findSimilarSentReplies(similarQuery, 8);
  }

  const learnedStyleGuide = await getWritingStylePrompt();
  const writingStyleRules = getWritingVoiceRules(replyLanguage);
  const { strength, gaps } = assessContextStrength({
    threadCount: threadMessages.length,
    companyEmailCount: companyContext?.email_count ?? 0,
    similarCount: similarReplies.length,
    bodyLength: body.trim().length,
  });

  return {
    currentEmail: {
      id: email.id,
      subject: email.subject,
      from_name: email.from_name,
      from_address: email.from_address,
      received_at: email.received_at,
      body,
      attachments: email.attachments,
    },
    threadMessages,
    companyContext,
    similarReplies,
    writingStyleRules,
    learnedStyleGuide,
    replyLanguage,
    contextStrength: strength,
    contextGaps: gaps,
  };
}

export function formatContextPackageForPrompt(context: EmailContextPackage): string {
  const attachmentSummary = context.currentEmail.attachments.length
    ? context.currentEmail.attachments
        .map((item) => `${item.filename} (${item.contentType}, ${item.size} B)`)
        .join(', ')
    : 'Nėra';

  const threadBlock =
    context.threadMessages.length > 1
      ? context.threadMessages
          .map(
            (item, index) =>
              `### ${index + 1}. ${item.received_at} | ${item.author}${item.is_self ? ' [TU]' : ''}\nTema: ${item.subject ?? '(be temos)'}\n${item.body}`
          )
          .join('\n\n')
      : '(Gijos istorijos nėra — tik dabartinis laiškas.)';

  const companyBlock = context.companyContext
    ? `Domenas: ${context.companyContext.domain}
Įmonė: ${context.companyContext.company_name}
Ankstesnių laiškų: ${context.companyContext.email_count}
Naujausios temos: ${context.companyContext.recent_subjects.join(' | ') || '—'}

Istorijos santrauka:
${context.companyContext.relationship_summary}

Atviros / svarbios temos:
${context.companyContext.open_topics}`
    : '(Siuntėjas iš bendro el. pašto domeno — įmonės istorijos nėra.)';

  const similarBlock =
    context.similarReplies.length > 0
      ? context.similarReplies
          .map(
            (item, index) =>
              `### Pavyzdys ${index + 1} (panašumas ${(item.similarity * 100).toFixed(0)}%)
Konteksto tema: ${item.context_subject ?? '—'}
Atsakymo tema: ${item.subject ?? '—'}
Tavo ankstesnis atsakymas:
${item.reply_text}`
          )
          .join('\n\n')
      : '(Panašių ankstesnių atsakymų nerasta.)';

  return `## 1. DABARTINIS LAIŠKAS
Tema: ${context.currentEmail.subject ?? '(be temos)'}
Siuntėjas: ${context.currentEmail.from_name ?? ''} <${context.currentEmail.from_address ?? 'nežinomas'}>
Data: ${context.currentEmail.received_at}
Prisegtukai: ${attachmentSummary}
Turinys:
${context.currentEmail.body || '(tuščias tekstas)'}

## 2. GIJOS KONTEKSTAS (naujausi svarbiausi)
${threadBlock}

## 3. KLIENTO / ĮMONĖS KONTEKSTAS
${companyBlock}

## 4. PANAŠŪS ANKSTESNI ATSAKYMAI (tik tavo išsiųsti)
${similarBlock}

## 5. KONTEKSTO KOKYBĖ
Stiprumas: ${context.contextStrength}
Trūkumai: ${context.contextGaps.length ? context.contextGaps.join('; ') : 'Nėra'}

Atsakymo kalba: ${context.replyLanguage === 'lt' ? 'lietuvių' : 'anglų'}`;
}
