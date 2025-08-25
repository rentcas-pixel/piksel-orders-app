import { supabase } from './supabase';
import { Comment, Reminder, FileAttachment } from '@/types';

export class SupabaseService {
  // Comments
  static async getComments(orderId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
        .from('orders-new')
        .upload(storagePath, file);
      
      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw uploadError;
      }
      
      // 2. Gauti public URL
      const { data: urlData } = supabase.storage
        .from('orders-new')
        .getPublicUrl(storagePath);
      
      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }
      
      // 3. Išsaugoti metaduomenis į DB (tik plokščias objektas)
      const metadata = {
        order_id: orderId,
        storage_path: storagePath,
        original_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString()
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
    console.log('📸 Starting printscreen upload...');
    
    try {
      // 1. Įkelti printscreen į Supabase Storage
      const fileName = `printscreen_${Date.now()}_${file.name}`;
      const storagePath = `${orderId}/printscreens/${fileName}`;
      
      console.log('📤 Uploading printscreen to Storage:', storagePath);
      
      const { error: uploadError } = await supabase.storage
        .from('orders-new')
        .upload(storagePath, file);
      
      if (uploadError) {
        console.error('❌ Printscreen upload failed:', uploadError);
        throw uploadError;
      }
      
      // 2. Gauti public URL
      const { data: urlData } = supabase.storage
        .from('orders-new')
        .getPublicUrl(storagePath);
      
      if (!urlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }
      
      // 3. Išsaugoti printscreen metaduomenis į DB
      const metadata = {
        order_id: orderId,
        storage_path: storagePath,
        original_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'image/png',
        uploaded_at: new Date().toISOString()
      };
      
      console.log('📤 Saving printscreen metadata to DB:', metadata);
      
      const { data: fileData, error: insertError } = await supabase
        .from('file_attachments')
        .insert([metadata])
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Failed to save printscreen metadata:', insertError);
        throw insertError;
      }
      
      console.log('✅ Printscreen uploaded successfully:', file.name);
      
      return {
        id: fileData.id,
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type || 'image/png',
        created_at: fileData.created_at
      };
      
    } catch (error) {
      console.error('❌ Printscreen upload failed:', error);
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

    // Extract file path from URL
    const filePath = file.file_url.split('/').slice(-2).join('/');
    
    const { error: deleteError } = await supabase.storage
      .from('orders-new')
      .remove([filePath]);

    if (deleteError) throw deleteError;

    const { error: dbError } = await supabase
      .from('file_attachments')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;
  }
}
