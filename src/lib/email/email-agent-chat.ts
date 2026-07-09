import OpenAI from 'openai';
import {
  buildEmailContextPackage,
  formatContextPackageForPrompt,
} from '@/lib/email/email-context-package';
import {
  buildFewShotSystemInstruction,
  formatFewShotBlockForPrompt,
} from '@/lib/email/email-few-shot';
import { normalizeDraftFormatting, extractFirstName } from '@/lib/email/email-draft-format';
import { getWritingVoiceRules } from '@/lib/email/email-writing-voice';
import {
  buildReplyLanguageInstruction,
  detectReplyLanguage,
} from '@/lib/email/email-language';
import { getEmailBodyForAi } from '@/lib/email/email-body-utils';
import { getOpenAiModel, withOptionalTemperature } from '@/lib/email/openai-config';
import type { ProcessedEmail } from '@/lib/email/types';

export interface EmailAgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EmailAgentChatResult {
  assistant_message: string;
  updated_draft: string | null;
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nerastas .env.local faile.');
  }
  return new OpenAI({ apiKey });
}

export async function chatWithEmailAgent(input: {
  email: ProcessedEmail;
  threadEmails: ProcessedEmail[];
  currentDraft: string;
  messages: EmailAgentChatMessage[];
  userMessage: string;
  mailboxAddress?: string;
}): Promise<EmailAgentChatResult> {
  const client = getOpenAiClient();
  const model = getOpenAiModel();
  const context = await buildEmailContextPackage(input.email, {
    threadEmails: input.threadEmails,
    mailboxAddress: input.mailboxAddress,
  });
  const bodyForAi = getEmailBodyForAi(input.email.body_text, input.email.body_html);
  const replyLanguage = detectReplyLanguage(input.email.subject, bodyForAi);
  const languageInstruction = buildReplyLanguageInstruction(replyLanguage);

  const systemParts = [
    'Esi Renatas el. pašto asistentas. Vartotojas ruošiasi atsakyti — patari ir, jei prašoma, atnaujini juodraštį.',
    'Atsakyk lietuviškai pokalbyje, nebent vartotojas rašo kita kalba.',
    'Tu NESIUNDI laiškų — tik patari. Juodraštis visada rankinei peržiūrai.',
    'Turi pilną konteksto paketą: dabartinis laiškas, gija, kliento istorija, few-shot pavyzdžiai.',
    'Nekurk faktų, kurių nėra kontekste. Jei kontekstas silpnas — pasakyk atvirai.',
    languageInstruction,
    buildFewShotSystemInstruction(replyLanguage, context.fewShotExamples.length),
    context.writingStyleRules,
    getWritingVoiceRules(replyLanguage),
    'Jei keiti juodraštį — grąžink pilną naują juodraštį updated_draft lauke. Jei tik patari — updated_draft = null.',
    'Nerašyk parašo juodraštyje.',
  ];

  const fewShotBlock = formatFewShotBlockForPrompt(context.fewShotExamples, replyLanguage);
  if (fewShotBlock) {
    systemParts.push(fewShotBlock);
  }

  const contextBlock = `${formatContextPackageForPrompt(context)}

ESAMAS JUODRAŠTIS:
${input.currentDraft.trim() || '(tuščias)'}`;

  const history = input.messages.slice(-12).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const response = await client.chat.completions.create({
    model,
    ...withOptionalTemperature(model, 0.4),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'email_agent_chat',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            assistant_message: { type: 'string' },
            updated_draft: { type: ['string', 'null'] },
          },
          required: ['assistant_message', 'updated_draft'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      { role: 'system', content: systemParts.join('\n\n') },
      { role: 'user', content: contextBlock },
      ...history,
      { role: 'user', content: input.userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI neatsakė.');
  }

  const parsed = JSON.parse(content) as EmailAgentChatResult;
  const draftContext = {
    replyLanguage,
    recipientFirstName: extractFirstName(input.email.from_name, input.email.from_address),
  };
  return {
    assistant_message: parsed.assistant_message.trim(),
    updated_draft: parsed.updated_draft
      ? normalizeDraftFormatting(parsed.updated_draft, draftContext)
      : null,
  };
}
