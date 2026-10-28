import { buildPartnerConfirmUrl } from '@/lib/partner-confirm-url';
import { sendResendEmail } from '@/lib/resend-client';

function plansFrom(): string {
  return (
    process.env.RESEND_FROM_PLANS?.trim() || 'Piksel <orders@piksel.lt>'
  );
}

function orderSubject(campaign: string, planNumber?: string): string {
  const num = String(planNumber || '').trim();
  return num ? `Užsakymas: ${campaign} | ${num}` : `Užsakymas: ${campaign}`;
}

function clipsSubject(campaign: string, planNumber?: string): string {
  const num = String(planNumber || '').trim();
  return num ? `Klipai: ${campaign} | ${num}` : `Klipai: ${campaign}`;
}

/** ISO / PocketBase datos → YYYY-MM-DD */
export function formatPartnerPlanDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || raw.slice(0, 10);
}

export function formatPartnerPlanPeriod(
  from?: string | null,
  to?: string | null
): string | undefined {
  const a = formatPartnerPlanDate(from);
  const b = formatPartnerPlanDate(to);
  if (!a && !b) return undefined;
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** href turi visą adresą. Paprastas tekstas pašte nukerta galinį „-“. */
function linkHtml(url: string): string {
  const safe = escapeHtml(url);
  return `<a href="${safe}">${safe}</a>`;
}

function emailHtml(blocks: string[]): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:#0f172a;">${blocks.join('')}</body></html>`;
}

function textBlock(value: string): string {
  return `<p style="margin:0 0 12px;">${escapeHtml(value)}</p>`;
}

export function buildPartnerPlanEmailText(input: {
  campaign: string;
  period?: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const lines = [
    'Sveiki,',
    '',
    `Siunčiame reklamos planą kampanijai ${input.campaign}.`,
  ];
  if (input.period) {
    lines.push(`Laikotarpis: ${input.period}`);
  }
  lines.push('', 'Patvirtinkite gavimą:', confirmUrl);
  return lines.join('\n');
}

export function buildPartnerPlanEmailHtml(input: {
  campaign: string;
  period?: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const blocks = [
    textBlock('Sveiki,'),
    textBlock(`Siunčiame reklamos planą kampanijai ${input.campaign}.`),
  ];
  if (input.period) blocks.push(textBlock(`Laikotarpis: ${input.period}`));
  blocks.push(
    `<p style="margin:0 0 12px;">Patvirtinkite gavimą:<br>${linkHtml(confirmUrl)}</p>`
  );
  return emailHtml(blocks);
}

export function buildPartnerClipsEmailText(input: {
  campaign: string;
  period?: string;
  clipUrl: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const lines = [
    'Sveiki,',
    '',
    `Siunčiame video klipus kampanijai ${input.campaign}.`,
  ];
  if (input.period) {
    lines.push(`Laikotarpis: ${input.period}`);
  }
  lines.push('', 'Nuoroda:', input.clipUrl, '', 'Patvirtinkite gavimą:', confirmUrl);
  return lines.join('\n');
}

export function buildPartnerClipsEmailHtml(input: {
  campaign: string;
  period?: string;
  clipUrl: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const blocks = [
    textBlock('Sveiki,'),
    textBlock(`Siunčiame video klipus kampanijai ${input.campaign}.`),
  ];
  if (input.period) blocks.push(textBlock(`Laikotarpis: ${input.period}`));
  blocks.push(`<p style="margin:0 0 12px;">Nuoroda:<br>${linkHtml(input.clipUrl)}</p>`);
  blocks.push(
    `<p style="margin:0 0 12px;">Patvirtinkite gavimą:<br>${linkHtml(confirmUrl)}</p>`
  );
  return emailHtml(blocks);
}

export const PARTNER_EMAIL_NOTE_MAX = 2000;

export function sanitizePartnerEmailNote(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .trim()
    .slice(0, PARTNER_EMAIL_NOTE_MAX);
}

/** Vienas laiškas: planas (XLS) + klipų nuoroda + neprivaloma pastaba. */
export function buildPartnerPackageEmailText(input: {
  campaign: string;
  period?: string;
  clipUrl: string;
  note?: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const lines = [
    'Sveiki,',
    '',
    `Siunčiame reklamos planą ir video klipus kampanijai ${input.campaign}.`,
  ];
  if (input.period) {
    lines.push(`Laikotarpis: ${input.period}`);
  }
  const note = sanitizePartnerEmailNote(input.note);
  if (note) {
    lines.push(note);
  }
  lines.push('', 'Klipų nuoroda:', input.clipUrl);
  lines.push('', 'Patvirtinkite gavimą:', confirmUrl);
  return lines.join('\n');
}

export function buildPartnerPackageEmailHtml(input: {
  campaign: string;
  period?: string;
  clipUrl: string;
  note?: string;
  confirmToken: string;
}): string {
  const confirmUrl = buildPartnerConfirmUrl(input.confirmToken);
  const blocks = [
    textBlock('Sveiki,'),
    textBlock(`Siunčiame reklamos planą ir video klipus kampanijai ${input.campaign}.`),
  ];
  if (input.period) blocks.push(textBlock(`Laikotarpis: ${input.period}`));
  const note = sanitizePartnerEmailNote(input.note);
  if (note) {
    blocks.push(
      `<p style="margin:0 0 12px;white-space:pre-wrap;">${escapeHtml(note)}</p>`
    );
  }
  blocks.push(
    `<p style="margin:0 0 12px;">Klipų nuoroda:<br>${linkHtml(input.clipUrl)}</p>`
  );
  blocks.push(
    `<p style="margin:0 0 12px;">Patvirtinkite gavimą:<br>${linkHtml(confirmUrl)}</p>`
  );
  return emailHtml(blocks);
}

export async function sendPartnerPlanEmail(input: {
  to: string[];
  campaign: string;
  planNumber?: string;
  partner: string;
  period?: string;
  confirmToken: string;
  filename: string;
  xlsxBase64: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = buildPartnerPlanEmailText({
    campaign: input.campaign,
    period: input.period,
    confirmToken: input.confirmToken,
  });
  const html = buildPartnerPlanEmailHtml({
    campaign: input.campaign,
    period: input.period,
    confirmToken: input.confirmToken,
  });

  const result = await sendResendEmail({
    to: input.to,
    from: plansFrom(),
    subject: orderSubject(input.campaign, input.planNumber),
    text,
    html,
    attachments: [
      {
        filename: input.filename,
        content: input.xlsxBase64,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    tags: [
      { name: 'kind', value: 'partner-plan' },
      { name: 'partner', value: input.partner.slice(0, 40) },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}

export async function sendPartnerClipsEmail(input: {
  to: string[];
  campaign: string;
  planNumber?: string;
  partner: string;
  period?: string;
  clipUrl: string;
  confirmToken: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = buildPartnerClipsEmailText({
    campaign: input.campaign,
    period: input.period,
    clipUrl: input.clipUrl,
    confirmToken: input.confirmToken,
  });
  const html = buildPartnerClipsEmailHtml({
    campaign: input.campaign,
    period: input.period,
    clipUrl: input.clipUrl,
    confirmToken: input.confirmToken,
  });

  const result = await sendResendEmail({
    to: input.to,
    from: plansFrom(),
    subject: clipsSubject(input.campaign, input.planNumber),
    text,
    html,
    tags: [
      { name: 'kind', value: 'partner-clips' },
      { name: 'partner', value: input.partner.slice(0, 40) },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}

export async function sendPartnerPackageEmail(input: {
  to: string[];
  campaign: string;
  planNumber?: string;
  partner: string;
  period?: string;
  clipUrl: string;
  note?: string;
  confirmToken: string;
  filename: string;
  xlsxBase64: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const text = buildPartnerPackageEmailText({
    campaign: input.campaign,
    period: input.period,
    clipUrl: input.clipUrl,
    note: input.note,
    confirmToken: input.confirmToken,
  });
  const html = buildPartnerPackageEmailHtml({
    campaign: input.campaign,
    period: input.period,
    clipUrl: input.clipUrl,
    note: input.note,
    confirmToken: input.confirmToken,
  });

  const result = await sendResendEmail({
    to: input.to,
    from: plansFrom(),
    subject: orderSubject(input.campaign, input.planNumber),
    text,
    html,
    attachments: [
      {
        filename: input.filename,
        content: input.xlsxBase64,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    tags: [
      { name: 'kind', value: 'partner-package' },
      { name: 'partner', value: input.partner.slice(0, 40) },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}
