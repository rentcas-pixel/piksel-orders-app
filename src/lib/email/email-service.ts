import { emailDb as supabase } from '@/lib/email/email-supabase';
import { hasRecipientAddresses, parseAddressList, parseRecipientEntry } from '@/lib/email/email-addresses';
import { isArchivedFolder, isEmailArchived, isEmailSent, isSentFolder } from '@/lib/email/imap-mailboxes';
import type {
  EmailCategory,
  EmailDraftStatus,
  EmailSyncState,
  ProcessedEmail,
} from '@/lib/email/types';

function isMissingArchivedAtColumn(error: { message?: string; code?: string }): boolean {
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(
      error.message?.includes('archived_at') &&
        (error.message?.includes('does not exist') ||
          error.message?.includes('schema cache'))
    )
  );
}

function isMissingThreadingColumn(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    Boolean(
      (error.message?.includes('in_reply_to') || error.message?.includes('reference_ids')) &&
        (error.message?.includes('does not exist') || error.message?.includes('schema cache'))
    )
  );
}

function isMissingRecipientColumns(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    Boolean(
      (error.message?.includes('to_addresses') || error.message?.includes('cc_addresses')) &&
        (error.message?.includes('does not exist') || error.message?.includes('schema cache'))
    )
  );
}

function isMissingReadAtColumn(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    Boolean(
      error.message?.includes('read_at') &&
        (error.message?.includes('does not exist') || error.message?.includes('schema cache'))
    )
  );
}

function isMissingRemindColumns(error: { message?: string; code?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    Boolean(
      (error.message?.includes('remind_at') || error.message?.includes('remind_note')) &&
        (error.message?.includes('does not exist') || error.message?.includes('schema cache'))
    )
  );
}

function mapProcessedEmail(row: Record<string, unknown>): ProcessedEmail {
  return {
    id: String(row.id),
    imap_uid: Number(row.imap_uid),
    message_id: row.message_id != null ? String(row.message_id) : null,
    in_reply_to: row.in_reply_to != null ? String(row.in_reply_to) : null,
    reference_ids: Array.isArray(row.reference_ids)
      ? row.reference_ids.map((item) => String(item))
      : [],
    folder: String(row.folder ?? 'INBOX'),
    subject: row.subject != null ? String(row.subject) : null,
    from_address: row.from_address != null ? String(row.from_address) : null,
    from_name: row.from_name != null ? String(row.from_name) : null,
    to_addresses: Array.isArray(row.to_addresses)
      ? row.to_addresses.map((item) => String(item))
      : [],
    cc_addresses: Array.isArray(row.cc_addresses)
      ? row.cc_addresses.map((item) => String(item))
      : [],
    received_at: String(row.received_at),
    body_text: row.body_text != null ? String(row.body_text) : null,
    body_html: row.body_html != null ? String(row.body_html) : null,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    category: row.category as EmailCategory,
    summary: row.summary != null ? String(row.summary) : null,
    importance_reason:
      row.importance_reason != null ? String(row.importance_reason) : null,
    recommended_action:
      row.recommended_action != null ? String(row.recommended_action) : null,
    draft_reply: row.draft_reply != null ? String(row.draft_reply) : null,
    draft_status: (row.draft_status as EmailDraftStatus) ?? 'none',
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    archived_at: row.archived_at != null ? String(row.archived_at) : null,
    read_at: row.read_at != null ? String(row.read_at) : null,
    remind_at: row.remind_at != null ? String(row.remind_at) : null,
    remind_note: row.remind_note != null ? String(row.remind_note) : null,
    processed_at: String(row.processed_at),
  };
}

function filterEmailSearch(
  rows: ProcessedEmail[],
  search?: string
): ProcessedEmail[] {
  const needle = search?.trim().toLowerCase();
  if (!needle) return rows;

  return rows.filter((email) => {
    const haystack = [
      email.subject,
      email.from_address,
      email.from_name,
      email.summary,
      email.to_addresses?.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export class EmailService {
  static async getKnownUids(folder = 'INBOX'): Promise<Set<number>> {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('imap_uid')
      .eq('folder', folder);

    if (error) throw error;
    return new Set((data ?? []).map((row) => Number(row.imap_uid)));
  }

  static async list(options?: {
    category?: EmailCategory | 'all';
    search?: string;
    limit?: number;
    archive?: 'active' | 'archived' | 'sent';
  }): Promise<ProcessedEmail[]> {
    const limit = options?.limit ?? 200;

    if (options?.archive === 'sent') {
      let query = supabase
        .from('processed_emails')
        .select('*')
        .or('folder.ilike.%sent%,draft_status.eq.sent')
        .order('received_at', { ascending: false })
        .limit(limit);

      if (options.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return filterEmailSearch((data ?? []).map(mapProcessedEmail), options.search);
    }

    if (options?.archive === 'active') {
      let query = supabase
        .from('processed_emails')
        .select('*')
        .not('folder', 'ilike', '%sent%')
        .not('folder', 'ilike', '%archive%')
        .is('archived_at', null)
        .order('received_at', { ascending: false })
        .limit(limit);

      if (options.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }

      let { data, error } = await query;
      if (error && isMissingArchivedAtColumn(error)) {
        query = supabase
          .from('processed_emails')
          .select('*')
          .not('folder', 'ilike', '%sent%')
          .not('folder', 'ilike', '%archive%')
          .order('received_at', { ascending: false })
          .limit(limit);
        if (options.category && options.category !== 'all') {
          query = query.eq('category', options.category);
        }
        ({ data, error } = await query);
      }

      if (error) throw error;
      let rows = (data ?? []).map(mapProcessedEmail);
      rows = rows.filter((email) => !isEmailArchived(email) && !isSentFolder(email.folder));
      return filterEmailSearch(rows, options.search);
    }

    const buildQuery = (withArchiveFilter: boolean) => {
      let query = supabase
        .from('processed_emails')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(limit);

      if (withArchiveFilter) {
        if (options?.archive === 'archived') {
          query = query.not('archived_at', 'is', null);
        }
      }

      if (options?.category && options.category !== 'all') {
        query = query.eq('category', options.category);
      }

      return query;
    };

    let { data, error } = await buildQuery(true);
    let filterArchiveByFolder = false;
    if (error && isMissingArchivedAtColumn(error)) {
      filterArchiveByFolder = true;
      ({ data, error } = await buildQuery(false));
    }
    if (error) throw error;

    let rows = (data ?? []).map(mapProcessedEmail);
    if (filterArchiveByFolder && options?.archive) {
      rows = rows.filter((email) =>
        options.archive === 'archived'
          ? isEmailArchived(email)
          : options.archive === 'sent'
            ? isSentFolder(email.folder)
            : !isEmailArchived(email) && !isSentFolder(email.folder)
      );
    } else if (options?.archive === 'archived') {
      rows = rows.filter((email) => isEmailArchived(email));
    }

    return filterEmailSearch(rows, options?.search);
  }

  static async getById(id: string): Promise<ProcessedEmail | null> {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProcessedEmail(data) : null;
  }

  static async listRecentForThreading(limit = 400): Promise<ProcessedEmail[]> {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapProcessedEmail);
  }

  static async listBySenderDomain(
    domain: string,
    options?: { excludeId?: string; limit?: number }
  ): Promise<ProcessedEmail[]> {
    const pattern = `%@${domain.toLowerCase()}`;
    let query = supabase
      .from('processed_emails')
      .select('*')
      .ilike('from_address', pattern)
      .order('received_at', { ascending: false })
      .limit(options?.limit ?? 25);

    if (options?.excludeId) {
      query = query.neq('id', options.excludeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapProcessedEmail);
  }

  static async insertProcessedEmail(payload: {
    imap_uid: number;
    message_id: string | null;
    in_reply_to?: string | null;
    reference_ids?: string[];
    folder: string;
    subject: string | null;
    from_address: string | null;
    from_name: string | null;
    to_addresses?: string[];
    cc_addresses?: string[];
    received_at: string;
    body_text: string | null;
    body_html: string | null;
    attachments: ProcessedEmail['attachments'];
    category: EmailCategory;
    summary: string;
    importance_reason: string;
    recommended_action: string;
    draft_reply: string | null;
    read_at?: string | null;
    draft_status?: EmailDraftStatus;
    sent_at?: string | null;
  }): Promise<ProcessedEmail> {
    const draftStatus: EmailDraftStatus =
      payload.draft_status ?? (payload.draft_reply ? 'draft' : 'none');
    const row = {
      ...payload,
      reference_ids: payload.reference_ids ?? [],
      to_addresses: payload.to_addresses ?? [],
      cc_addresses: payload.cc_addresses ?? [],
      draft_status: draftStatus,
      sent_at: payload.sent_at ?? null,
    };

    let insertRow: Record<string, unknown> = row;
    let { data, error } = await supabase.from('processed_emails').insert([insertRow]).select().single();

    if (error && isMissingThreadingColumn(error)) {
      const { in_reply_to: _inReplyTo, reference_ids: _referenceIds, ...legacyRow } = insertRow;
      insertRow = legacyRow;
      ({ data, error } = await supabase.from('processed_emails').insert([insertRow]).select().single());
    }

    if (error && isMissingRecipientColumns(error)) {
      const { to_addresses: _to, cc_addresses: _cc, ...legacyRow } = insertRow;
      insertRow = legacyRow;
      ({ data, error } = await supabase.from('processed_emails').insert([insertRow]).select().single());
    }

    if (error && isMissingReadAtColumn(error)) {
      const { read_at: _readAt, ...legacyRow } = insertRow;
      insertRow = legacyRow;
      ({ data, error } = await supabase.from('processed_emails').insert([insertRow]).select().single());
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async updateDraft(
    id: string,
    draftReply: string
  ): Promise<ProcessedEmail> {
    const { data, error } = await supabase
      .from('processed_emails')
      .update({
        draft_reply: draftReply,
        draft_status: 'draft',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async listSentWithReplies(limit = 40): Promise<ProcessedEmail[]> {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('*')
      .eq('draft_status', 'sent')
      .not('draft_reply', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapProcessedEmail);
  }

  static async listRecentSent(limit = 80): Promise<ProcessedEmail[]> {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('*')
      .or('folder.ilike.%sent%,draft_status.eq.sent')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapProcessedEmail);
  }

  private static sentEmailMatchesRecipient(
    email: ProcessedEmail,
    recipientEmail: string
  ): boolean {
    const target = recipientEmail.trim().toLowerCase();
    if (!target) return false;

    for (const entry of email.to_addresses ?? []) {
      const parsed = parseRecipientEntry(entry).email.toLowerCase();
      if (parsed === target) return true;
    }

    return false;
  }

  private static sentEmailMatchesDomain(email: ProcessedEmail, domain: string): boolean {
    const target = domain.trim().toLowerCase();
    if (!target) return false;

    for (const entry of email.to_addresses ?? []) {
      const parsed = parseRecipientEntry(entry).email.toLowerCase();
      if (parsed.endsWith(`@${target}`)) return true;
    }

    return false;
  }

  static async listSentToRecipient(
    recipientEmail: string,
    limit = 5
  ): Promise<ProcessedEmail[]> {
    const emails = await EmailService.listRecentSent(Math.max(limit * 12, 60));
    return emails
      .filter((email) => EmailService.sentEmailMatchesRecipient(email, recipientEmail))
      .slice(0, limit);
  }

  static async listSentToDomain(domain: string, limit = 5): Promise<ProcessedEmail[]> {
    const emails = await EmailService.listRecentSent(Math.max(limit * 12, 60));
    return emails
      .filter((email) => EmailService.sentEmailMatchesDomain(email, domain))
      .slice(0, limit);
  }

  static async updateGeneratedReply(
    id: string,
    payload: {
      draft_reply: string;
      summary?: string;
      recommended_action?: string;
    }
  ): Promise<ProcessedEmail> {
    const { data, error } = await supabase
      .from('processed_emails')
      .update({
        draft_reply: payload.draft_reply,
        draft_status: 'draft',
        summary: payload.summary ?? undefined,
        recommended_action: payload.recommended_action ?? undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async markSent(
    id: string,
    sentReply: string,
    recipients?: { to?: string; cc?: string }
  ): Promise<ProcessedEmail> {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      draft_reply: sentReply,
      draft_status: 'sent',
      sent_at: now,
    };

    if (recipients?.to) {
      payload.to_addresses = parseAddressList(recipients.to);
    }
    if (recipients?.cc) {
      payload.cc_addresses = parseAddressList(recipients.cc);
    }

    const { data, error } = await supabase
      .from('processed_emails')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingRecipientColumns(error)) {
      const { to_addresses: _to, cc_addresses: _cc, ...legacyPayload } = payload;
      const fallback = await supabase
        .from('processed_emails')
        .update(legacyPayload)
        .eq('id', id)
        .select()
        .single();
      if (fallback.error) throw fallback.error;
      return mapProcessedEmail(fallback.data);
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async markArchived(id: string, archiveFolder: string): Promise<ProcessedEmail> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('processed_emails')
      .update({
        archived_at: now,
        folder: archiveFolder,
      })
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingArchivedAtColumn(error)) {
      const fallback = await supabase
        .from('processed_emails')
        .update({ folder: archiveFolder })
        .eq('id', id)
        .select()
        .single();
      if (fallback.error) throw fallback.error;
      return {
        ...mapProcessedEmail(fallback.data as Record<string, unknown>),
        archived_at: now,
      };
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async listActiveInboxForReadSync(sinceIso: string): Promise<
    Pick<ProcessedEmail, 'id' | 'imap_uid' | 'folder' | 'read_at' | 'received_at'>[]
  > {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('id, imap_uid, folder, read_at, received_at')
      .eq('folder', 'INBOX')
      .is('archived_at', null)
      .gte('received_at', sinceIso);

    if (error && isMissingArchivedAtColumn(error)) {
      const fallback = await supabase
        .from('processed_emails')
        .select('id, imap_uid, folder, read_at, received_at')
        .eq('folder', 'INBOX')
        .gte('received_at', sinceIso);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        id: String(row.id),
        imap_uid: Number(row.imap_uid),
        folder: String(row.folder ?? 'INBOX'),
        read_at: row.read_at != null ? String(row.read_at) : null,
        received_at: String(row.received_at),
      }));
    }

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: String(row.id),
      imap_uid: Number(row.imap_uid),
      folder: String(row.folder ?? 'INBOX'),
      read_at: row.read_at != null ? String(row.read_at) : null,
      received_at: String(row.received_at),
    }));
  }

  static async markRead(id: string, readAt?: string): Promise<ProcessedEmail> {
    const now = readAt ?? new Date().toISOString();
    const { data, error } = await supabase
      .from('processed_emails')
      .update({ read_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingReadAtColumn(error)) {
      const existing = await EmailService.getById(id);
      if (!existing) throw new Error('Laiškas nerastas.');
      return existing;
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async markReadMany(ids: string[]): Promise<ProcessedEmail[]> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('processed_emails')
      .update({ read_at: now })
      .in('id', uniqueIds)
      .is('read_at', null)
      .select();

    if (error && isMissingReadAtColumn(error)) {
      return [];
    }

    if (error) throw error;
    return (data ?? []).map(mapProcessedEmail);
  }

  static async setReminder(
    id: string,
    reminder: { remind_at: string | null; remind_note?: string | null }
  ): Promise<ProcessedEmail> {
    const payload = {
      remind_at: reminder.remind_at,
      remind_note: reminder.remind_note?.trim() ? reminder.remind_note.trim() : null,
    };

    const { data, error } = await supabase
      .from('processed_emails')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingRemindColumns(error)) {
      const existing = await EmailService.getById(id);
      if (!existing) throw new Error('Laiškas nerastas.');
      return existing;
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async reactivateDueReminders(): Promise<number> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('processed_emails')
      .update({ read_at: null })
      .not('remind_at', 'is', null)
      .lte('remind_at', now)
      .not('read_at', 'is', null)
      .select('id');

    if (error && isMissingRemindColumns(error)) {
      return 0;
    }

    if (error && isMissingReadAtColumn(error)) {
      return 0;
    }

    if (error) throw error;
    return data?.length ?? 0;
  }

  static async hasRecipientColumns(): Promise<boolean> {
    const { error } = await supabase.from('processed_emails').select('to_addresses').limit(1);
    if (!error) return true;
    return !isMissingRecipientColumns(error);
  }

  static async listSentMissingRecipients(): Promise<
    Array<{ id: string; imap_uid: number; folder: string }>
  > {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('id, imap_uid, to_addresses, folder, draft_status')
      .order('received_at', { ascending: false })
      .limit(500);

    if (error && isMissingRecipientColumns(error)) {
      const fallback = await supabase
        .from('processed_emails')
        .select('id, imap_uid, folder, draft_status')
        .order('received_at', { ascending: false })
        .limit(500);

      if (fallback.error) throw fallback.error;

      return (fallback.data ?? [])
        .filter((row) =>
          isEmailSent({
            folder: String(row.folder ?? ''),
            draft_status: String(row.draft_status ?? 'none'),
          })
        )
        .map((row) => ({
          id: String(row.id),
          imap_uid: Number(row.imap_uid),
          folder: String(row.folder ?? 'Sent'),
        }));
    }

    if (error) throw error;

    return (data ?? [])
      .filter((row) =>
        isEmailSent({
          folder: String(row.folder ?? ''),
          draft_status: String(row.draft_status ?? 'none'),
        })
      )
      .filter((row) =>
        !hasRecipientAddresses(
          Array.isArray(row.to_addresses)
            ? row.to_addresses.map((item) => String(item))
            : []
        )
      )
      .map((row) => ({
        id: String(row.id),
        imap_uid: Number(row.imap_uid),
        folder: String(row.folder ?? 'Sent'),
      }));
  }

  static async updateRecipients(
    id: string,
    recipients: { to_addresses: string[]; cc_addresses?: string[] }
  ): Promise<ProcessedEmail | null> {
    const payload = {
      to_addresses: recipients.to_addresses,
      cc_addresses: recipients.cc_addresses ?? [],
    };

    const { data, error } = await supabase
      .from('processed_emails')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error && isMissingRecipientColumns(error)) {
      return null;
    }

    if (error) throw error;
    return mapProcessedEmail(data);
  }

  static async getSyncState(): Promise<EmailSyncState> {
    const { data, error } = await supabase
      .from('email_sync_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    return {
      last_synced_at: data?.last_synced_at ?? null,
      last_sync_count: Number(data?.last_sync_count ?? 0),
      last_sync_error: data?.last_sync_error ?? null,
      updated_at: data?.updated_at ?? new Date().toISOString(),
    };
  }

  static async updateSyncState(payload: {
    last_sync_count: number;
    last_sync_error?: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase.from('email_sync_state').upsert({
      id: 1,
      last_synced_at: now,
      last_sync_count: payload.last_sync_count,
      last_sync_error: payload.last_sync_error ?? null,
      updated_at: now,
    });

    if (error) throw error;
  }
}
