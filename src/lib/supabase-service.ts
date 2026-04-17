import { supabase } from './supabase';
import { Comment, Reminder, FileAttachment, OrderApprovalEvent, OrderInvoiceStatus } from '@/types';

export class SupabaseService {
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
  static async getComments(orderId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Load printscreens for this order
    const printscreens = await this.getPrintscreensForOrder(orderId);
    
    // Add printscreens to all comments (simple approach)
    const commentsWithPrintscreens = (data || []).map(comment => ({
      ...comment,
      printscreens: printscreens
    }));
    
    return commentsWithPrintscreens;
  }

  static async getPrintscreensForOrder(orderId: string): Promise<FileAttachment[]> {
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
      
      // Filter printscreens on client side
      const printscreens = (data || []).filter(file => 
        file.file_type && file.file_type.startsWith('image/')
      );
      

      return printscreens;
      
    } catch (error) {
      console.error('❌ Error loading printscreens:', error);
      return [];
    }
  }

  static async addComment(comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert([{ 
        ...comment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
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
  static async getReminders(orderId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('order_id', orderId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async addReminder(orderId: string, reminder: Omit<Reminder, 'id' | 'order_id' | 'created_at'>): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .insert([{ 
        order_id: orderId, 
        ...reminder,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
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

  // File Attachments
  static async getFiles(orderId: string): Promise<FileAttachment[]> {
    const { data, error } = await supabase
      .from('file_attachments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async uploadFileToStorage(orderId: string, file: File): Promise<FileAttachment> {
    console.log('🔍 Starting file upload to Storage...');
    
    try {
      // 1. Įkelti failą į Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `${orderId}/${fileName}`;
      
      console.log('📤 Uploading to Storage:', storagePath);
      
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, file);
      
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
        file_type: file.type || 'application/octet-stream',
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
        file_type: file.type || 'application/octet-stream',
        created_at: fileData.created_at
      };
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  static async uploadPrintscreen(orderId: string, file: File): Promise<FileAttachment> {
    try {
      // 1. Įkelti printscreen į Supabase Storage
      const fileName = `printscreen_${Date.now()}_${file.name}`;
      const storagePath = `${orderId}/printscreens/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, file);
      
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
        file_type: file.type || 'image/png',
        created_at: new Date().toISOString()
      };
      
      const { data: fileData, error: insertError } = await supabase
        .from('file_attachments')
        .insert([metadata])
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      return {
        id: fileData.id,
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type || 'image/png',
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
