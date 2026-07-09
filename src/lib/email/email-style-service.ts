import { emailDb as supabase } from '@/lib/email/email-supabase';
import { fetchEmailsForStyleLearning } from '@/lib/email/imap-style-fetch';
import { getStyleFolderKeys, getStyleMaxEmails } from '@/lib/email/imap-mailboxes';
import {
  parseFewShotCorpus,
  pickCorpusExamplesFromSamples,
  serializeFewShotCorpus,
  examplesFromStoredCorpus,
  type FewShotCorpus,
  type StoredFewShotExample,
} from '@/lib/email/email-few-shot';
import type { FewShotExample } from '@/lib/email/types';

export interface EmailWritingStyle {
  style_guide: string;
  emails_analyzed: number;
  folders: string | null;
  updated_at: string;
  few_shot_count: number;
}

export interface EmailWritingStyleSummary {
  style_guide: string | null;
  emails_analyzed: number;
  folders: string | null;
  updated_at: string | null;
  active: boolean;
  few_shot_count: number;
  max_emails: number;
  folder_keys: string[];
}

function getSummaryFromRow(data: Record<string, unknown> | null): EmailWritingStyleSummary {
  const rawGuide = data?.style_guide != null ? String(data.style_guide) : null;
  const corpus = parseFewShotCorpus(rawGuide);
  const folderKeys = getStyleFolderKeys();

  return {
    style_guide: rawGuide,
    emails_analyzed: Number(data?.emails_analyzed ?? 0),
    folders: data?.folders != null ? String(data.folders) : null,
    updated_at: data?.updated_at != null ? String(data.updated_at) : null,
    active: Boolean(corpus && corpus.examples.length > 0),
    few_shot_count: corpus?.examples.length ?? 0,
    max_emails: getStyleMaxEmails(),
    folder_keys: folderKeys,
  };
}

export async function getEmailWritingStyleSummary(): Promise<EmailWritingStyleSummary> {
  const { data, error } = await supabase
    .from('email_writing_style')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  return getSummaryFromRow(data);
}

export async function getEmailWritingStyle(): Promise<EmailWritingStyle | null> {
  const summary = await getEmailWritingStyleSummary();
  if (!summary.active || !summary.style_guide || !summary.updated_at) return null;

  return {
    style_guide: summary.style_guide,
    emails_analyzed: summary.emails_analyzed,
    folders: summary.folders,
    updated_at: summary.updated_at,
    few_shot_count: summary.few_shot_count,
  };
}

export async function countEmailStyleCandidates(): Promise<number> {
  const samples = await fetchEmailsForStyleLearning();
  return samples.length;
}

export async function getStoredFewShotCorpus(): Promise<FewShotCorpus | null> {
  const summary = await getEmailWritingStyleSummary();
  return parseFewShotCorpus(summary.style_guide);
}

export async function getStoredFewShotExamples(): Promise<FewShotExample[]> {
  const corpus = await getStoredFewShotCorpus();
  return examplesFromStoredCorpus(corpus);
}

export async function learnEmailWritingStyleFromMailbox(): Promise<EmailWritingStyle> {
  const samples = await fetchEmailsForStyleLearning();
  if (samples.length < 3) {
    throw new Error(
      'Per mažai jūsų laiškų Sent / Archive aplankuose stiliui išmokti (reikia bent 3).'
    );
  }

  const folders = getStyleFolderKeys().join(', ');
  const examples: StoredFewShotExample[] = pickCorpusExamplesFromSamples(samples);
  if (examples.length < 3) {
    throw new Error('Nepavyko parinkti pakankamai įvairių few-shot pavyzdžių.');
  }

  const corpus: FewShotCorpus = { version: 1, examples };
  const styleGuide = serializeFewShotCorpus(corpus);
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

  const parsed = parseFewShotCorpus(String(data.style_guide));

  return {
    style_guide: String(data.style_guide),
    emails_analyzed: Number(data.emails_analyzed),
    folders: data.folders != null ? String(data.folders) : null,
    updated_at: String(data.updated_at),
    few_shot_count: parsed?.examples.length ?? examples.length,
  };
}

/** @deprecated Naudok getStoredFewShotExamples / formatFewShotBlockForPrompt */
export async function getWritingStylePrompt(): Promise<string | null> {
  const corpus = await getStoredFewShotCorpus();
  if (!corpus || corpus.examples.length === 0) return null;
  return `${corpus.examples.length} few-shot pavyzdžiai įkelti.`;
}
