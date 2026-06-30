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
  /** Ekranų ID masyvas iš PocketBase */
  screens?: string[];
  /** Ekrano kainos pagal ID (jei yra) */
  details?: {
    screenPrices?: Record<string, number>;
    views?: number;
    cpt?: number;
    discount?: number;
    finalPrice?: number;
  };
}

export interface Screen {
  id: string;
  name: string;
  city?: string;
  type?: string;
  viaduct?: boolean;
  partner?: string; // Partner ID
}

export interface Partner {
  id: string;
  name: string;
  slug?: string;
}

export interface OrderFormData {
  client: string;
  agency: string;
  invoice_id: string;
  approved: 'taip' | 'ne';
  viaduct: boolean;
  from: string;
  to: string;
  media_received: boolean;
  final_price: number;
  invoice_sent: boolean;
  intensity?: string;
}

export type CommentVisibility = 'internal' | 'agency';

export interface Comment {
  id: string;
  order_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  /** internal — tik Piksel komanda; agency — matoma agentūroms */
  visibility?: CommentVisibility;
  printscreens?: FileAttachment[];
}

export interface Reminder {
  id: string;
  order_id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  created_at: string;
  /** internal — tik Piksel; agency — tik agentūros portalas */
  visibility?: CommentVisibility;
}

export interface FileAttachment {
  id: string;
  order_id: string;
  filename: string;
  file_url: string;
  file_type: string;
  created_at: string;
  /** internal — tik Piksel; agency — tik agentūros portalas */
  visibility?: CommentVisibility;
}

export interface OrderApprovalEvent {
  id: string;
  order_id: string;
  approved_at: string;
  approved_by?: string | null;
  snapshot_client?: string | null;
  snapshot_amount?: number | null;
  created_at: string;
}

export interface OrderInvoiceStatus {
  order_id: string;
  invoice_issued: boolean;
  invoice_sent: boolean;
  updated_at: string;
}

export interface BillingCompany {
  id: string;
  name: string;
  full_name: string;
  company_code?: string | null;
  vat_code?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  order_id: string;
  line_description: string;
  period_from?: string | null;
  period_to?: string | null;
  amount: number;
  sort_order: number;
  created_at: string;
}

export type InvoiceLineInput = Omit<InvoiceLine, 'id' | 'invoice_id' | 'created_at'>;

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  invoice_date: string;
  due_date: string;
  payment_date?: string | null;
  paid_amount?: number;
  buyer_name: string;
  buyer_company_code?: string | null;
  buyer_vat_code?: string | null;
  buyer_address?: string | null;
  line_description?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceSaveInput = Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'payment_date'>;

export interface ReceivedInvoice {
  id: string;
  invoice_number?: string | null;
  seller_name: string;
  seller_company_code?: string | null;
  seller_vat_code?: string | null;
  seller_address?: string | null;
  amount: number;
  vat_amount: number;
  total_amount: number;
  currency?: string | null;
  invoice_date: string;
  due_date?: string | null;
  payment_date?: string | null;
  paid_amount?: number;
  category?: string | null;
  description?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ReceivedInvoiceInput = Omit<ReceivedInvoice, 'id' | 'created_at' | 'updated_at'>;

export type BankDirection = 'income' | 'expense';

export interface BankTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  direction: BankDirection;
  counterparty: string;
  description?: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  allocated_amount?: number;
}

export type BankTransactionInput = Pick<
  BankTransaction,
  'transaction_date' | 'amount' | 'direction' | 'counterparty' | 'description' | 'source'
>;

export interface PaymentAllocation {
  id: string;
  bank_transaction_id: string;
  issued_invoice_id?: string | null;
  received_invoice_id?: string | null;
  amount: number;
  created_at: string;
}

export interface BuyerFields {
  name: string;
  company_code: string;
  vat_code: string;
  address: string;
}

export type BuyerSource = 'agency' | 'client' | 'saved' | 'manual';

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

export type OrderStatus = 'taip' | 'ne';
