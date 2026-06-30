import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { getEmailBodyForAi } from '@/lib/email/email-body-utils';
import type { ProcessedEmail } from '@/lib/email/types';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nerastas .env.local faile.');
  }
  return new OpenAI({ apiKey });
}

function isMissingEmbeddingsTable(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    Boolean(
      error.message?.includes('email_reply_embeddings') ||
        error.message?.includes('match_similar_email_replies') ||
        error.message?.includes('vector')
    )
  );
}

function buildEmbeddingInput(email: ProcessedEmail): string {
  const reply = email.draft_reply?.trim() || email.body_text?.trim() || '';
  const subject = email.subject?.trim() || '';
  const to = email.to_addresses?.join(', ') || '';
  return [`Subject: ${subject}`, `To: ${to}`, '', reply].join('\n').trim();
}

export async function createEmbeddingVector(text: string): Promise<number[]> {
  const client = getOpenAiClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!vector?.length) {
    throw new Error('OpenAI negrąžino embedding.');
  }
  return vector;
}

export async function embedSentEmailReply(
  email: ProcessedEmail,
  contextSubject?: string | null
): Promise<void> {
  const replyText = email.draft_reply?.trim();
  if (!replyText || email.draft_status !== 'sent') return;

  try {
    const embedding = await createEmbeddingVector(buildEmbeddingInput(email));
    const { error } = await supabase.from('email_reply_embeddings').upsert(
      {
        email_id: email.id,
        embedding,
        subject: email.subject,
        reply_text: replyText,
        context_subject: contextSubject ?? email.subject,
        to_addresses: email.to_addresses?.join(', ') ?? null,
        sent_at: email.sent_at ?? email.received_at,
      },
      { onConflict: 'email_id' }
    );

    if (error && !isMissingEmbeddingsTable(error)) {
      throw error;
    }
  } catch (error) {
    console.warn('Nepavyko išsaugoti reply embedding:', error);
  }
}

export async function findSimilarSentReplies(
  queryText: string,
  limit = 8
): Promise<
  Array<{
    subject: string | null;
    reply_text: string;
    context_subject: string | null;
    similarity: number;
  }>
> {
  try {
    const embedding = await createEmbeddingVector(queryText);
    const { data, error } = await supabase.rpc('match_similar_email_replies', {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      if (isMissingEmbeddingsTable(error)) return [];
      throw error;
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      subject: row.subject != null ? String(row.subject) : null,
      reply_text: String(row.reply_text ?? ''),
      context_subject: row.context_subject != null ? String(row.context_subject) : null,
      similarity: Number(row.similarity ?? 0),
    }));
  } catch (error) {
    console.warn('Panašių atsakymų paieška nepavyko:', error);
    return [];
  }
}

export async function backfillSentReplyEmbeddings(limit = 40): Promise<number> {
  const { EmailService } = await import('@/lib/email/email-service');
  const emails = await EmailService.listSentWithReplies(limit);

  for (const email of emails) {
    await embedSentEmailReply(email, email.subject);
  }
  return emails.length;
}
