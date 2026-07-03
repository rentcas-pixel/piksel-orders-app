import { supabase } from './supabase';
import { Comment, Reminder, FileAttachment, OrderApprovalEvent, OrderInvoiceStatus, CommentVisibility, type Order } from '@/types';
import { InvoiceService } from '@/lib/invoice-service';
import {
  buildMonthStatusMap,
  emptyBillingMonthInvoiceFlags,
  monthFlagKey,
  toOrderInvoiceStatus,
  type BillingMonthContext,
  type BillingMonthInvoiceFlags,
} from '@/lib/invoice-month-status';

/** Nuotraukos ir Excel (.xls / .xlsx) rodomi užsakymo modalo „Printscreens“ skiltyje */
function isPrintscreenPanelFile(
  fileType: string | null | undefined,
  filename: string | null | undefined
): boolean {
  const ft = (fileType || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  if (ft.startsWith('image/')) return true;
  if (name.endsWith('.xls') || name.endsWith('.xlsx')) return true;
  if (ft === 'application/vnd.ms-excel') return true;
  if (ft === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return true;
  if (ft.includes('spreadsheetml')) return true;
  return false;
}

function resolveAttachmentFileType(file: File): string {
  const n = file.name.toLowerCase();
  const t = (file.type || '').toLowerCase();

  if (n.endsWith('.xlsx')) {
    if (
      !t ||
      t === 'application/octet-stream' ||
      t === 'application/zip' ||
      t.includes('spreadsheetml')
    ) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    return file.type;
  }
  if (n.endsWith('.xls')) {
    if (!t || t === 'application/octet-stream') return 'application/vnd.ms-excel';
    return file.type || 'application/vnd.ms-excel';
  }
  if (file.type) return file.type;
  if (/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name)) return 'image/png';
  return 'application/octet-stream';
}

/**
 * Excel: bucket dažnai leidžia tik image/* — kelias su .png ir deklaruojamas image/png (turinys lieka xlsx zip).
 * Kitas ne paveikslėlis (pvz. PDF) — originalus File.
 */
async function bodyForStorageUpload(
  file: File,
  resolvedType: string
): Promise<{ body: Blob; contentType: string }> {
  if (resolvedType.startsWith('image/')) {
    const contentType = file.type || resolvedType;
    return { body: file, contentType };
  }
  if (isSpreadsheetUpload(file, resolvedType)) {
    const buf = await file.arrayBuffer();
    return {
      body: new Blob([buf], { type: 'image/png' }),
      contentType: 'image/png',
    };
  }
  const contentType = file.type || resolvedType || 'application/octet-stream';
  return { body: file, contentType };
}

/** Storage raktas su .png plėtiniu, kad strict allowlist priimtų Excel baitus kaip „paveikslėlį“. */
function storageObjectLeafSpreadsheetAsPng(safeBaseName: string): string {
  const stem = safeBaseName.replace(/\.(xlsx|xls)$/i, '').trim();
  return `${stem || 'attachment'}.png`;
}

function isSpreadsheetUpload(file: File, resolvedType: string): boolean {
  const n = file.name.toLowerCase();
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return true;
  const t = (resolvedType || '').toLowerCase();
  return (
    t.includes('spreadsheetml') ||
    t === 'application/vnd.ms-excel' ||
    (t.startsWith('application/') && t.includes('excel'))
  );
}

function matchesVisibility(
  rowVisibility: string | null | undefined,
  scope: CommentVisibility
): boolean {
  const value = rowVisibility ?? 'internal';
  if (scope === 'agency') return value === 'agency';
  return value === 'internal';
}

function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  column = 'visibility'
): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  if (error.code === 'PGRST204') {
    return (error.message ?? '').includes(`'${column}'`);
  }
  return false;
}

async function insertRowLegacyVisibility<T extends Record<string, unknown>>(
  table: 'comments' | 'reminders',
  payload: T
) {
  let result = await supabase.from(table).insert([payload] as never[]).select().single();

  if (result.error && isMissingColumnError(result.error) && 'visibility' in payload) {
    const { visibility: _visibility, ...legacyPayload } = payload;
    result = await supabase.from(table).insert([legacyPayload] as never[]).select().single();
  }

  return result;
}

function filterByVisibility<T extends { visibility?: string | null }>(
  rows: T[],
  scope: CommentVisibility
): T[] {
  return rows.filter((row) => matchesVisibility(row.visibility, scope));
}

async function insertFileAttachmentRow(
  metadata: Record<string, unknown>
): Promise<{ data: FileAttachment; error: null } | { data: null; error: Error }> {
  const withVisibility = {
    ...metadata,
    visibility: (metadata.visibility as string | undefined) ?? 'internal',
  };

  let result = await supabase
    .from('file_attachments')
    .insert([withVisibility])
    .select()
    .single();

  if (isMissingColumnError(result.error)) {
    const { visibility: _visibility, ...legacyMetadata } = withVisibility;
    result = await supabase
      .from('file_attachments')
      .insert([legacyMetadata])
      .select()
      .single();
  }

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: result.data as FileAttachment, error: null };
}

export class SupabaseService {
  static async getOrderCommentOrScreenshotMap(orderIds: string[]): Promise<Record<string, boolean>> {
    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
    if (uniqueOrderIds.length === 0) return {};

    const [commentsResult, filesResult] = await Promise.all([
      supabase
        .from('comments')
        .select('order_id')
        .in('order_id', uniqueOrderIds),
      supabase
        .from('file_attachments')
        .select('order_id,file_type,filename')
        .in('order_id', uniqueOrderIds),
    ]);

    if (commentsResult.error) throw commentsResult.error;
    if (filesResult.error) throw filesResult.error;

    const hasActivityMap: Record<string, boolean> = {};
    for (const orderId of uniqueOrderIds) {
      hasActivityMap[orderId] = false;
    }

    for (const row of commentsResult.data || []) {
      if (row.order_id) hasActivityMap[row.order_id] = true;
    }

    for (const row of filesResult.data || []) {
      if (!row.order_id) continue;
      if (isPrintscreenPanelFile(row.file_type, row.filename)) {
        hasActivityMap[row.order_id] = true;
      }
    }

    return hasActivityMap;
  }

  // Invoice statuses
  static async getInvoiceStatuses(orderIds: string[]): Promise<Record<string, OrderInvoiceStatus>> {
    if (orderIds.length === 0) return {};

    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
    if (uniqueOrderIds.length === 0) return {};

    const { data, error } = await supabase
      .from('order_invoice_status')
      .select('*')
      .in('order_id', uniqueOrderIds);

    if (error) throw error;

    const statusMap: Record<string, OrderInvoiceStatus> = {};
    for (const status of data || []) {
      statusMap[status.order_id] = status;
    }
    return statusMap;
  }

  static async getOrderInvoiceMonthFlags(
    orderIds: string[],
    billing: BillingMonthContext | null
  ): Promise<Record<string, BillingMonthInvoiceFlags>> {
    if (!billing?.month || !billing?.year || orderIds.length === 0) return {};

    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
    const year = parseInt(billing.year, 10);
    const month = parseInt(billing.month, 10);
    if (Number.isNaN(year) || Number.isNaN(month)) return {};

    const { data, error } = await supabase
      .from('order_invoice_month_flags')
      .select('order_id, invoice_issued, invoice_sent')
      .in('order_id', uniqueOrderIds)
      .eq('billing_year', year)
      .eq('billing_month', month);

    if (error) {
      console.error('getOrderInvoiceMonthFlags:', error);
      return {};
    }

    const flags: Record<string, BillingMonthInvoiceFlags> = {};
    for (const row of data ?? []) {
      flags[monthFlagKey(row.order_id, billing.year, billing.month)] = {
        invoice_issued: !!row.invoice_issued,
        invoice_sent: !!row.invoice_sent,
      };
    }
    return flags;
  }

  static async upsertOrderInvoiceMonthFlags(
    orderId: string,
    billing: BillingMonthContext,
    flags: BillingMonthInvoiceFlags
  ): Promise<void> {
    const year = parseInt(billing.year, 10);
    const month = parseInt(billing.month, 10);
    if (!orderId || Number.isNaN(year) || Number.isNaN(month)) return;

    const { error } = await supabase.from('order_invoice_month_flags').upsert(
      {
        order_id: orderId,
        billing_year: year,
        billing_month: month,
        invoice_issued: flags.invoice_issued,
        invoice_sent: flags.invoice_sent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id,billing_year,billing_month' }
    );

    if (error) throw error;
  }

  static async upsertOrderInvoiceMonthSent(
    orderId: string,
    billing: BillingMonthContext,
    invoiceSent: boolean
  ): Promise<void> {
    const existing =
      (await this.getOrderInvoiceMonthFlags([orderId], billing))[
        monthFlagKey(orderId, billing.year, billing.month)
      ] ?? emptyBillingMonthInvoiceFlags();
    await this.upsertOrderInvoiceMonthFlags(orderId, billing, {
      ...existing,
      invoice_sent: invoiceSent,
    });
  }

  static async getMonthInvoiceStatuses(
    orders: Order[],
    billing: BillingMonthContext | null
  ): Promise<Record<string, OrderInvoiceStatus>> {
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length === 0) return {};

    const ordersById = Object.fromEntries(orders.map((order) => [order.id, order]));
    const [coverages, legacyStatuses, monthFlags] = await Promise.all([
      InvoiceService.getOrderInvoiceCoverages(orderIds),
      this.getInvoiceStatuses(orderIds),
      this.getOrderInvoiceMonthFlags(orderIds, billing),
    ]);

    const monthStatuses = buildMonthStatusMap({
      orderIds,
      ordersById,
      billing,
      coverages,
      legacyStatuses,
      monthFlags,
    });

    const result: Record<string, OrderInvoiceStatus> = {};
    for (const orderId of orderIds) {
      const status = monthStatuses[orderId];
      if (status) {
        result[orderId] = toOrderInvoiceStatus(orderId, status);
      }
    }
    return result;
  }

  static getMonthInvoiceStatusValue(
    statusMap: Record<string, OrderInvoiceStatus>,
    order: Order,
    field: keyof Pick<OrderInvoiceStatus, 'invoice_issued' | 'invoice_sent'>
  ): boolean {
    const status = statusMap[order.id];
    if (field === 'invoice_issued') {
      return status?.invoice_issued ?? !!order.invoice_sent;
    }
    return status?.invoice_sent ?? false;
  }

  static async upsertInvoiceStatus(
    orderId: string,
    patch: Partial<Pick<OrderInvoiceStatus, 'invoice_issued' | 'invoice_sent'>>
  ): Promise<OrderInvoiceStatus> {
    const { data, error } = await supabase
      .from('order_invoice_status')
      .upsert(
        {
          order_id: orderId,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Approval Events
  static async getRecentApprovalEvents(limit = 50): Promise<OrderApprovalEvent[]> {
    const { data, error } = await supabase
      .from('order_approval_events')
      .select('*')
      .order('approved_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async getLatestApprovalEventsByOrderIds(orderIds: string[]): Promise<Record<string, OrderApprovalEvent>> {
    if (orderIds.length === 0) return {};

    const { data, error } = await supabase
      .from('order_approval_events')
      .select('*')
      .in('order_id', orderIds)
      .order('approved_at', { ascending: false });

    if (error) throw error;

    const latest: Record<string, OrderApprovalEvent> = {};
    for (const event of data || []) {
      if (!latest[event.order_id]) latest[event.order_id] = event;
    }
    return latest;
  }

  static async addApprovalEvent(event: {
    order_id: string;
    approved_at?: string;
    approved_by?: string;
    snapshot_client?: string;
    snapshot_amount?: number;
  }): Promise<OrderApprovalEvent> {
    const { data, error } = await supabase
      .from('order_approval_events')
      .insert([
        {
          order_id: event.order_id,
          approved_at: event.approved_at || new Date().toISOString(),
          approved_by: event.approved_by || null,
          snapshot_client: event.snapshot_client || null,
          snapshot_amount: event.snapshot_amount ?? null,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Comments
  static async getComments(
    orderId: string,
    options?: { visibility?: 'agency' | 'internal' }
  ): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    let rows = (data || []) as Comment[];

    if (options?.visibility === 'agency') {
      rows = rows.filter((c) => c.visibility === 'agency');
    } else {
      rows = rows.filter((c) => (c.visibility ?? 'internal') === 'internal');
    }

    const scope = options?.visibility ?? 'internal';
    const printscreens = await this.getPrintscreensForOrder(orderId, scope);

    return rows.map((comment) => ({
      ...comment,
      visibility: comment.visibility ?? 'internal',
      printscreens,
    }));
  }

  static async getPrintscreensForOrder(
    orderId: string,
    visibility: CommentVisibility = 'internal'
  ): Promise<FileAttachment[]> {
    try {
      const { data, error } = await supabase
        .from('file_attachments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to load printscreens:', error);
        return [];
      }

      const printscreens = filterByVisibility(data || [], visibility).filter((file) =>
        isPrintscreenPanelFile(file.file_type, file.filename)
      );

      return printscreens.map((file) => ({
        ...file,
        visibility: file.visibility ?? 'internal',
      }));
    } catch (error) {
      console.error('❌ Error loading printscreens:', error);
      return [];
    }
  }

  static async addComment(comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>): Promise<Comment> {
    const payload = {
      ...comment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await insertRowLegacyVisibility('comments', payload);

    if (error) throw error;
    return {
      ...data,
      visibility: data.visibility ?? comment.visibility ?? 'internal',
    } as Comment;
  }

  static async updateComment(id: string, text: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .update({ text, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteComment(id: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Reminders
  static async getReminders(
    orderId: string,
    options?: { visibility?: CommentVisibility }
  ): Promise<Reminder[]> {
    const visibility = options?.visibility ?? 'internal';
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('order_id', orderId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return filterByVisibility(data || [], visibility).map((reminder) => ({
      ...reminder,
      visibility: reminder.visibility ?? 'internal',
    }));
  }

  static async addReminder(
    orderId: string,
    reminder: Omit<Reminder, 'id' | 'order_id' | 'created_at' | 'visibility'>,
    visibility: CommentVisibility = 'internal'
  ): Promise<Reminder> {
    const payload = {
      order_id: orderId,
      ...reminder,
      visibility,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await insertRowLegacyVisibility('reminders', payload);

    if (error) throw error;
    return {
      ...data,
      visibility: data.visibility ?? visibility,
    } as Reminder;
  }

  static async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /** Neužbaigti vidiniai priminimai iki nurodytos datos (įskaitant). */
  static async getUpcomingInternalReminders(dueBeforeYmd: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('is_completed', false)
      .lte('due_date', dueBeforeYmd)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return filterByVisibility(data || [], 'internal').map((reminder) => ({
      ...reminder,
      visibility: reminder.visibility ?? 'internal',
    }));
  }

  // File Attachments
  static async getFiles(
    orderId: string,
    visibility: CommentVisibility = 'internal'
  ): Promise<FileAttachment[]> {
    const { data, error } = await supabase
      .from('file_attachments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return filterByVisibility(data || [], visibility).map((file) => ({
      ...file,
      visibility: file.visibility ?? 'internal',
    }));
  }

  static async uploadFileToStorage(orderId: string, file: File): Promise<FileAttachment> {
    console.log('🔍 Starting file upload to Storage...');
    
    try {
      // 1. Įkelti failą į Supabase Storage
      const safeBaseName = file.name.replace(/[/\\]/g, '-');
      const resolvedType = resolveAttachmentFileType(file);
      const storageLeaf =
        resolvedType.startsWith('image/') || !isSpreadsheetUpload(file, resolvedType)
          ? `${Date.now()}_${safeBaseName}`
          : `${Date.now()}_${storageObjectLeafSpreadsheetAsPng(safeBaseName)}`;
      const storagePath = `${orderId}/${storageLeaf}`;

      const { body, contentType } = await bodyForStorageUpload(file, resolvedType);

      console.log('📤 Uploading to Storage:', storagePath);

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, body, {
          contentType,
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw uploadError;
      }
      
      // 2. Gauti public URL
      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(storagePath);
      
      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }
      
      // 3. Išsaugoti metaduomenis į DB (tik plokščias objektas)
      const metadata = {
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: resolvedType,
        created_at: new Date().toISOString()
      };
      
      console.log('📤 Saving metadata to DB:', metadata);
      
      const { data: fileData, error: insertError } = await supabase
        .from('file_attachments')
        .insert([metadata])
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Failed to save metadata:', insertError);
        throw insertError;
      }
      
      console.log('✅ File uploaded successfully:', file.name);
      
      return {
        id: fileData.id,
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: resolvedType,
        created_at: fileData.created_at
      };
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  static async uploadPrintscreen(
    orderId: string,
    file: File,
    visibility: CommentVisibility = 'internal'
  ): Promise<FileAttachment> {
    try {
      const safeBaseName = file.name.replace(/[/\\]/g, '-');
      const resolvedType = resolveAttachmentFileType(file);
      const ts = Date.now();
      const storageLeaf =
        resolvedType.startsWith('image/') || !isSpreadsheetUpload(file, resolvedType)
          ? `printscreen_${ts}_${safeBaseName}`
          : `printscreen_${ts}_${storageObjectLeafSpreadsheetAsPng(safeBaseName)}`;
      const storagePath = `${orderId}/printscreens/${storageLeaf}`;

      const { body, contentType } = await bodyForStorageUpload(file, resolvedType);

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, body, {
          contentType,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Gauti public URL
      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(storagePath);

      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // 3. Išsaugoti printscreen metaduomenis į DB
      const metadata = {
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: resolvedType,
        visibility,
        created_at: new Date().toISOString()
      };

      const { data: fileData, error: insertError } = await insertFileAttachmentRow(metadata);

      if (insertError) {
        throw insertError;
      }

      return {
        id: fileData.id,
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: resolvedType,
        visibility: fileData.visibility ?? visibility,
        created_at: fileData.created_at
      };

    } catch (error) {
      console.error('Printscreen upload failed:', error);
      throw error;
    }
  }

  static async deleteFile(id: string): Promise<void> {
    const { data: file, error: fetchError } = await supabase
      .from('file_attachments')
      .select('file_url')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Extract file path from URL - get everything after the bucket name
    const url = new URL(file.file_url);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === 'files');
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    const { error: deleteError } = await supabase.storage
      .from('files')
      .remove([filePath]);

    if (deleteError) {
      throw deleteError;
    }

    const { error: dbError } = await supabase
      .from('file_attachments')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw dbError;
    }
  }
}
