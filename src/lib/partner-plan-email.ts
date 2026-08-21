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

  const result = await sendResendEmail({
    to: input.to,
    from: plansFrom(),
    subject: orderSubject(input.campaign, input.planNumber),
    text,
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

  const result = await sendResendEmail({
    to: input.to,
    from: plansFrom(),
    subject: clipsSubject(input.campaign, input.planNumber),
    text,
    tags: [
      { name: 'kind', value: 'partner-clips' },
      { name: 'partner', value: input.partner.slice(0, 40) },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}
