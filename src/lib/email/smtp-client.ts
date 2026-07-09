import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import nodemailer from 'nodemailer';
import { assertEmailConfigReady, getEmailPassword } from '@/lib/email/config';
import {
  collectEnvelopeRecipients,
  parseAddressList,
} from '@/lib/email/email-addresses';
import { appendMessageToSentFolder } from '@/lib/email/imap-sent';
import { buildOutgoingEmail, stripEmailSignature } from '@/lib/email/signature';
import {
  mergeMailAttachments,
  type ParsedOutgoingAttachment,
} from '@/lib/email/outgoing-attachments';
import type { ProcessedEmail } from '@/lib/email/types';

export interface SendReplyInput {
  email: ProcessedEmail;
  replyText: string;
  to: string;
  cc?: string;
  bcc?: string;
  attachments?: ParsedOutgoingAttachment[];
}

export interface SendNewEmailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: ParsedOutgoingAttachment[];
}

function createTransport() {
  const config = assertEmailConfigReady();
  const password = getEmailPassword();

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.username,
      pass: password,
    },
  });
}

function buildReplySubject(subject: string | null): string {
  const trimmed = (subject ?? '').trim();
  if (!trimmed) return 'Re:';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function buildReferencesHeader(email: ProcessedEmail): string | undefined {
  const refs = [email.message_id, ...(email.reference_ids ?? [])].filter(
    (item): item is string => Boolean(item)
  );
  return refs.length > 0 ? refs.join(' ') : undefined;
}

function buildReplyMailOptions(input: SendReplyInput) {
  const config = assertEmailConfigReady();
  const { email, replyText, attachments = [] } = input;
  const to = input.to.trim();
  const cc = input.cc?.trim() ?? '';
  const bcc = input.bcc?.trim() ?? '';

  if (!to) {
    throw new Error('Nurodykite bent vieną gavėją.');
  }
  if (parseAddressList(to).length === 0) {
    throw new Error('Neteisingas gavėjo adresas.');
  }

  const outgoing = buildOutgoingEmail(stripEmailSignature(replyText));

  return {
    from: `"${config.fromName}" <${config.username}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject: buildReplySubject(email.subject),
    text: outgoing.text,
    html: outgoing.html,
    attachments: mergeMailAttachments(outgoing.attachments, attachments),
    inReplyTo: email.message_id ?? undefined,
    references: buildReferencesHeader(email),
  };
}

function buildNewMailOptions(input: SendNewEmailInput) {
  const config = assertEmailConfigReady();
  const outgoing = buildOutgoingEmail(stripEmailSignature(input.body));
  const to = input.to.trim();
  const cc = input.cc?.trim() ?? '';
  const bcc = input.bcc?.trim() ?? '';

  return {
    from: `"${config.fromName}" <${config.username}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject: input.subject.trim(),
    text: outgoing.text,
    html: outgoing.html,
    attachments: mergeMailAttachments(outgoing.attachments, input.attachments ?? []),
  };
}

function compileMail(message: Record<string, unknown>): Promise<Buffer> {
  const mail = new MailComposer(message);
  return new Promise((resolve, reject) => {
    mail.compile().build((error: Error | null, raw: Buffer) => {
      if (error) reject(error);
      else resolve(raw);
    });
  });
}

async function deliverMail(
  recipients: string[],
  rawMessage: Buffer
): Promise<void> {
  if (recipients.length === 0) {
    throw new Error('Nurodykite bent vieną gavėją.');
  }

  const transporter = createTransport();
  await transporter.sendMail({
    envelope: {
      from: assertEmailConfigReady().username,
      to: recipients,
    },
    raw: rawMessage,
  });

  try {
    await appendMessageToSentFolder(rawMessage);
  } catch (error) {
    console.error('Nepavyko įrašyti į Sent aplanką:', error);
  }
}

export async function sendEmailReply(input: SendReplyInput): Promise<void> {
  const mailOptions = buildReplyMailOptions(input);
  const rawMessage = await compileMail(mailOptions);
  const recipients = collectEnvelopeRecipients(input.to, input.cc, input.bcc);
  await deliverMail(recipients, rawMessage);
}

export async function sendNewEmail(input: SendNewEmailInput): Promise<void> {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!to) throw new Error('Nurodykite gavėją.');
  if (!subject) throw new Error('Nurodykite temą.');
  if (!body) throw new Error('Laiško tekstas negali būti tuščias.');

  const mailOptions = buildNewMailOptions({ ...input, to, subject, body });
  const rawMessage = await compileMail(mailOptions);
  const recipients = collectEnvelopeRecipients(input.to, input.cc, input.bcc);
  await deliverMail(recipients, rawMessage);
}

export async function testSmtpConnection(): Promise<void> {
  const transporter = createTransport();
  await transporter.verify();
}
