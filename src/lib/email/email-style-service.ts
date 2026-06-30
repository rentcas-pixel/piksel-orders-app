import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { fetchEmailsForStyleLearning } from '@/lib/email/imap-style-fetch';
import { getStyleFolderKeys, getStyleMaxEmails } from '@/lib/email/imap-mailboxes';
import { getOpenAiModel, withOptionalTemperature } from '@/lib/email/openai-config';
import { RENATAS_WRITING_PRINCIPLES_LT } from '@/lib/email/email-writing-voice';

export interface EmailWritingStyle {
  style_guide: string;
  emails_analyzed: number;
  folders: string | null;
  updated_at: string;
}

export interface EmailWritingStyleSummary {
  style_guide: string | null;
  emails_analyzed: number;
  folders: string | null;
  updated_at: string | null;
  active: boolean;
  max_emails: number;
  folder_keys: string[];
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nerastas .env.local faile.');
  }
  return new OpenAI({ apiKey });
}

export async function getEmailWritingStyleSummary(): Promise<EmailWritingStyleSummary> {
  const { data, error } = await supabase
    .from('email_writing_style')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;

  const styleGuide = data?.style_guide?.trim() ? String(data.style_guide) : null;
  const folderKeys = getStyleFolderKeys();

  return {
    style_guide: styleGuide,
    emails_analyzed: Number(data?.emails_analyzed ?? 0),
    folders: data?.folders != null ? String(data.folders) : null,
    updated_at: data?.updated_at != null ? String(data.updated_at) : null,
    active: Boolean(styleGuide),
    max_emails: getStyleMaxEmails(),
    folder_keys: folderKeys,
  };
}

export async function getEmailWritingStyle(): Promise<EmailWritingStyle | null> {
  const summary = await getEmailWritingStyleSummary();
  if (!summary.active || !summary.style_guide || !summary.updated_at) return null;

  return {
    style_guide: summary.style_guide,
    emails_analyzed: summary.emails_analyzed,
    folders: summary.folders,
    updated_at: summary.updated_at,
  };
}

export async function countEmailStyleCandidates(): Promise<number> {
  const samples = await fetchEmailsForStyleLearning();
  return samples.length;
}

export async function learnEmailWritingStyleFromMailbox(): Promise<EmailWritingStyle> {
  const samples = await fetchEmailsForStyleLearning();
  if (samples.length < 3) {
    throw new Error(
      'Per mažai jūsų laiškų Sent / Archive aplankuose stiliui išmokti (reikia bent 3).'
    );
  }

  const client = getOpenAiClient();
  const model = getOpenAiModel();
  const folders = getStyleFolderKeys().join(', ');

  const corpus = samples
    .map(
      (sample, index) =>
        `--- Laiškas ${index + 1} (${sample.folder}) ---\nTema: ${sample.subject ?? '(be temos)'}\nData: ${sample.date.toISOString()}\n${sample.bodyText}`
    )
    .join('\n\n');

  const response = await client.chat.completions.create({
    model,
    ...withOptionalTemperature(model, 0.3),
    messages: [
      {
        role: 'system',
        content:
          'Esi el. pašto stiliaus analitikas. Iš vartotojo išsiųstų laiškų išskirk rašymo stilių lietuvių kalba.',
      },
      {
        role: 'user',
        content: `Išanalizuok šiuos laiškus ir suformuok TRUMPĄ stiliaus gidą (max 400 žodžių), kurį naudos AI generuodamas atsakymus.

Pagrindiniai principai (AI visada laikosi jų — tavo gidas tik papildo):
${RENATAS_WRITING_PRINCIPLES_LT}

Išskirk TIK tai, kas specifiška šiam vartotojui ir skiriasi nuo bendrų principų:
- tipinį pasisveikinimą (kreipinys: „Labas Vyteni,“)
- dažnas frazes ir posakius
- kaip įvardija problemas ir sprendimus
- kaip remiasi sutartimis / punktais
- tipinį laiško ilgį (sakinių skaičių)
- ko papildomai vengia

Nerašyk pavyzdinių atsakymų — tik stiliaus taisykles.

Laiškai:
${corpus}`,
      },
    ],
  });

  const styleGuide = response.choices[0]?.message?.content?.trim();
  if (!styleGuide) {
    throw new Error('OpenAI negrąžino stiliaus gido.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('email_writing_style')
    .upsert({
      id: 1,
      style_guide: styleGuide,
      emails_analyzed: samples.length,
      folders,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    style_guide: String(data.style_guide),
    emails_analyzed: Number(data.emails_analyzed),
    folders: data.folders != null ? String(data.folders) : null,
    updated_at: String(data.updated_at),
  };
}

export async function getWritingStylePrompt(): Promise<string | null> {
  const style = await getEmailWritingStyle();
  if (!style?.style_guide) return null;
  return style.style_guide;
}
