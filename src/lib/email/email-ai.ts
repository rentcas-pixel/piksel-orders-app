import OpenAI from 'openai';
import { getEmailBodyForAi } from '@/lib/email/email-body-utils';
import {
  buildEmailContextPackage,
  formatContextPackageForPrompt,
} from '@/lib/email/email-context-package';
import {
  buildReplyLanguageInstruction,
  getReplyLanguageLabel,
} from '@/lib/email/email-language';
import {
  normalizeDraftFormatting,
  getReplyFormattingRules,
  extractFirstName,
} from '@/lib/email/email-draft-format';
import { getOpenAiModel, withOptionalTemperature } from '@/lib/email/openai-config';
import type {
  EmailAiAnalysis,
  EmailCategory,
  EmailReplyGeneration,
  ProcessedEmail,
} from '@/lib/email/types';

const CATEGORIES: EmailCategory[] = [
  'urgent',
  'needs_reply',
  'invoice_payment',
  'informational',
  'ignore',
];

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nerastas .env.local faile.');
  }
  return new OpenAI({ apiKey });
}

function truncateText(value: string | null, maxLength: number): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export async function analyzeEmailWithAi(input: {
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  receivedAt: Date;
  bodyText: string | null;
  bodyHtml?: string | null;
  attachments: { filename: string; contentType: string; size: number }[];
}): Promise<EmailAiAnalysis> {
  const client = getOpenAiClient();
  const model = getOpenAiModel();
  const bodyForAi = getEmailBodyForAi(input.bodyText, input.bodyHtml ?? null);

  const attachmentSummary =
    input.attachments.length > 0
      ? input.attachments
          .map((item) => `${item.filename} (${item.contentType}, ${item.size} B)`)
          .join(', ')
      : 'Nėra';

  const prompt = `Analizuok šį el. laišką. Laukus summary, importance_reason ir recommended_action rašyk lietuvių kalba.
Nekurk atsakymo juodraščio — draft_reply visada null.

Kategorijos (category):
- urgent — skubus, reikalauja greito dėmesio
- needs_reply — reikia atsakyti
- invoice_payment — sąskaita, mokėjimas, finansinis dokumentas
- informational — informacinis, nereikalauja veiksmų
- ignore — nereikšmingas, reklama, spam

Laiškas:
Tema: ${input.subject ?? '(be temos)'}
Siuntėjas: ${input.fromName ?? ''} <${input.fromAddress ?? 'nežinomas'}>
Data: ${input.receivedAt.toISOString()}
Prisegtukai: ${attachmentSummary}
Turinys:
${truncateText(bodyForAi, 6000) || '(tuščias tekstas)'}`;

  const response = await client.chat.completions.create({
    model,
    ...withOptionalTemperature(model, 0.2),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'email_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: CATEGORIES },
            summary: { type: 'string' },
            importance_reason: { type: 'string' },
            recommended_action: { type: 'string' },
            draft_reply: { type: ['string', 'null'] },
          },
          required: [
            'category',
            'summary',
            'importance_reason',
            'recommended_action',
            'draft_reply',
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'Esi el. pašto asistentas verslo dėžutei. Niekada nesiųsk laiškų — tik analizuok ir rekomenduok veiksmus. Juodraščio nekurk.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI negrąžino analizės rezultato.');
  }

  const parsed = JSON.parse(content) as EmailAiAnalysis;
  return { ...parsed, draft_reply: null };
}

export async function generateEmailReplyWithContext(
  email: ProcessedEmail,
  options?: {
    threadEmails?: ProcessedEmail[];
    mailboxAddress?: string;
  }
): Promise<EmailReplyGeneration> {
  const client = getOpenAiClient();
  const model = getOpenAiModel();
  const context = await buildEmailContextPackage(email, options);
  const languageInstruction = buildReplyLanguageInstruction(context.replyLanguage);
  const formattingRules = getReplyFormattingRules(context.replyLanguage);

  const systemParts = [
    'Esi Renatas el. pašto asistentas. Generuoji atsakymo juodraštį rankinei peržiūrai — NIEKADA nesiunti automatiškai.',
    languageInstruction,
    formattingRules,
    context.writingStyleRules,
    'Stilius: trumpai, tiesiai, praktiškai, mandagiai bet tvirtai. Be korporacinio vandens. Be ilgų įžangų. Aiškus kitas žingsnis.',
    'Jei sprendimas priimtas — „padarysime“, ne „galėtume“. Nerašyk kaip ChatGPT.',
    'Nekurk faktų, kurių nėra kontekste. Jei trūksta informacijos — įrašyk į missing_information.',
    'Jei contextStrength weak — confidence turi būti low arba medium, ne high.',
    'Nerašyk el. pašto parašo — jis pridedamas automatiškai.',
    'Nerašyk uždarymo (Pagarbiai, Best regards) — tik laiško turinį.',
  ];

  if (context.learnedStyleGuide) {
    systemParts.push(
      context.replyLanguage === 'lt'
        ? `Papildomas stilius iš ankstesnių laiškų:\n${context.learnedStyleGuide}`
        : `Additional tone from past emails:\n${context.learnedStyleGuide}`
    );
  }

  const response = await client.chat.completions.create({
    model,
    ...withOptionalTemperature(model, 0.3),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'email_reply_generation',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            suggested_action: { type: 'string' },
            draft_reply: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            missing_information: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'summary',
            'suggested_action',
            'draft_reply',
            'confidence',
            'missing_information',
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      { role: 'system', content: systemParts.join('\n\n') },
      {
        role: 'user',
        content: `Remiantis šiuo konteksto paketu, sugeneruok atsakymą.

${formatContextPackageForPrompt(context)}

Grąžink:
- summary: trumpa esmė (1–2 sakiniai, lietuviškai)
- suggested_action: konkretus kitas veiksmas (lietuviškai)
- draft_reply: atsakymo juodraštis (${getReplyLanguageLabel(context.replyLanguage)})
- confidence: high | medium | low
- missing_information: ko trūksta sprendimui (tuščias masyvas jei nieko)`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI negeneravo atsakymo.');
  }

  const parsed = JSON.parse(content) as EmailReplyGeneration;
  const draftContext = {
    replyLanguage: context.replyLanguage,
    recipientFirstName: extractFirstName(email.from_name, email.from_address),
  };

  return {
    ...parsed,
    draft_reply: normalizeDraftFormatting(parsed.draft_reply, draftContext),
    missing_information: parsed.missing_information ?? [],
  };
}

/** @deprecated Naudok generateEmailReplyWithContext */
export async function generateEmailDraftReply(input: {
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  bodyText: string | null;
  bodyHtml?: string | null;
  summary?: string | null;
  recommendedAction?: string | null;
}): Promise<string> {
  const pseudoEmail = {
    id: 'draft-only',
    imap_uid: 0,
    message_id: null,
    in_reply_to: null,
    reference_ids: [],
    folder: 'INBOX',
    subject: input.subject,
    from_address: input.fromAddress,
    from_name: input.fromName,
    received_at: new Date().toISOString(),
    body_text: input.bodyText,
    body_html: input.bodyHtml ?? null,
    attachments: [],
    category: 'needs_reply' as const,
    summary: input.summary ?? null,
    importance_reason: null,
    recommended_action: input.recommendedAction ?? null,
    draft_reply: null,
    draft_status: 'none' as const,
    sent_at: null,
    archived_at: null,
    read_at: null,
    remind_at: null,
    remind_note: null,
    processed_at: new Date().toISOString(),
  };

  const result = await generateEmailReplyWithContext(pseudoEmail);
  return result.draft_reply;
}
