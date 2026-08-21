export type ResendAttachment = {
  filename: string;
  /** Base64 turinys */
  content: string;
  contentType?: string;
};

export type ResendSendInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
  tags?: { name: string; value: string }[];
};

export type ResendSendResult = {
  ok: true;
  id: string;
  to: string[];
} | {
  ok: false;
  error: string;
  status?: number;
};

function getApiKey(): string {
  return String(process.env.RESEND_API_KEY || '').trim();
}

export function getResendFrom(): string {
  return (
    String(process.env.RESEND_FROM || '').trim() ||
    'Piksel <alerts@piksel.lt>'
  );
}

export function isResendConfigured(): boolean {
  return getApiKey().length > 0;
}

/** Siunčia laišką per Resend API. */
export async function sendResendEmail(
  input: ResendSendInput
): Promise<ResendSendResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY nerastas (.env.local)' };
  }

  const to = (Array.isArray(input.to) ? input.to : [input.to])
    .map((item) => item.trim())
    .filter(Boolean);
  if (!to.length) {
    return { ok: false, error: 'Nėra gavėjo' };
  }
  if (!input.subject.trim()) {
    return { ok: false, error: 'Nėra temos' };
  }
  if (!input.html?.trim() && !input.text?.trim()) {
    return { ok: false, error: 'Nėra laiško turinio' };
  }

  const payload: Record<string, unknown> = {
    from: input.from?.trim() || getResendFrom(),
    to,
    subject: input.subject.trim(),
  };
  if (input.html?.trim()) payload.html = input.html;
  if (input.text?.trim()) payload.text = input.text;
  if (input.replyTo?.trim()) payload.reply_to = input.replyTo.trim();
  if (input.attachments?.length) payload.attachments = input.attachments;
  if (input.tags?.length) payload.tags = input.tags;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.message || body.name || `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    id: String(body.id || ''),
    to,
  };
}
