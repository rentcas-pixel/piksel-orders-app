export type EmailCategory =
  | 'urgent'
  | 'needs_reply'
  | 'invoice_payment'
  | 'informational'
  | 'ignore';

export type EmailDraftStatus = 'none' | 'draft' | 'sent';

export interface EmailAttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface ProcessedEmail {
  id: string;
  imap_uid: number;
  message_id: string | null;
  in_reply_to: string | null;
  reference_ids: string[];
  folder: string;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses?: string[];
  cc_addresses?: string[];
  received_at: string;
  body_text: string | null;
  body_html: string | null;
  attachments: EmailAttachmentMeta[];
  category: EmailCategory;
  summary: string | null;
  importance_reason: string | null;
  recommended_action: string | null;
  draft_reply: string | null;
  draft_status: EmailDraftStatus;
  sent_at: string | null;
  archived_at: string | null;
  read_at: string | null;
  remind_at: string | null;
  remind_note: string | null;
  processed_at: string;
}

export type EmailArchiveFilter = 'active' | 'unread' | 'reminders' | 'sent' | 'archived';

export interface EmailSyncState {
  last_synced_at: string | null;
  last_sync_count: number;
  last_sync_error: string | null;
  updated_at: string;
}

export interface EmailMailboxConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  fromName: string;
  passwordConfigured: boolean;
}

export interface EmailAiAnalysis {
  category: EmailCategory;
  summary: string;
  importance_reason: string;
  recommended_action: string;
  draft_reply: string | null;
}

export type EmailReplyConfidence = 'high' | 'medium' | 'low';

export type EmailContextStrength = 'strong' | 'moderate' | 'weak';

export interface EmailReplyGeneration {
  summary: string;
  suggested_action: string;
  draft_reply: string;
  confidence: EmailReplyConfidence;
  missing_information: string[];
}

export interface SimilarPastReply {
  subject: string | null;
  reply_text: string;
  context_subject: string | null;
  similarity: number;
}

export type FewShotSource = 'thread' | 'recipient' | 'domain' | 'similar' | 'corpus';

export interface FewShotExample {
  source: FewShotSource;
  subject: string | null;
  body: string;
  date?: string;
  recipient?: string;
  similarity?: number;
  priority: number;
}

export interface EmailContextPackage {
  currentEmail: {
    id: string;
    subject: string | null;
    from_name: string | null;
    from_address: string | null;
    received_at: string;
    body: string;
    attachments: EmailAttachmentMeta[];
  };
  threadMessages: Array<{
    received_at: string;
    author: string;
    is_self: boolean;
    subject: string | null;
    body: string;
  }>;
  companyContext: {
    domain: string;
    company_name: string;
    email_count: number;
    relationship_summary: string;
    open_topics: string;
    recent_subjects: string[];
  } | null;
  similarReplies: SimilarPastReply[];
  fewShotExamples: FewShotExample[];
  writingStyleRules: string;
  replyLanguage: 'lt' | 'en';
  contextStrength: EmailContextStrength;
  contextGaps: string[];
}

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  urgent: 'Skubus',
  needs_reply: 'Reikia atsakyti',
  invoice_payment: 'Sąskaita / Mokėjimas',
  informational: 'Informacinis',
  ignore: 'Ignoruoti',
};

export const EMAIL_CATEGORY_COLORS: Record<EmailCategory, string> = {
  urgent: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  needs_reply: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  invoice_payment: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  informational: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ignore: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
};
