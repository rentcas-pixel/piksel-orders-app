export interface Order {
  id: string;
  client: string;
  agency: string;
  invoice_id: string;
  approved: boolean;
  viaduct: boolean;
  from: string;
  to: string;
  media_received: boolean;
  final_price: number;
  invoice_sent: boolean;
  updated: string;
  intensity?: string; // Kas 4, Kas 6, Kas 8, Kas 12, Kas 24
}

export interface OrderFormData {
  client: string;
  agency: string;
  invoice_id: string;
  approved: 'taip' | 'ne' | 'rezervuota' | 'atšaukta';
  viaduct: boolean;
  from: string;
  to: string;
  media_received: boolean;
  final_price: number;
  invoice_sent: boolean;
  intensity?: string;
}

export interface Comment {
  id: string;
  order_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  printscreens?: FileAttachment[];
}

export interface Reminder {
  id: string;
  order_id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  created_at: string;
}

export interface FileAttachment {
  id: string;
  order_id: string;
  filename: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  filters: {
    month?: string;
    year?: string;
    status?: string;
    client?: string;
    agency?: string;
  };
  created_at: string;
}

export type OrderStatus = 'taip' | 'ne' | 'rezervuota' | 'atšaukta';
