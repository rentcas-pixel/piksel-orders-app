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

  static async uploadFile(orderId: string, file: File): Promise<FileAttachment> {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${orderId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('orders')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('orders')
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('file_attachments')
      .insert([{
        order_id: orderId,
        filename: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
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
      .from('orders')
      .remove([filePath]);

    if (deleteError) throw deleteError;

    const { error: dbError } = await supabase
      .from('file_attachments')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;
  }
}
