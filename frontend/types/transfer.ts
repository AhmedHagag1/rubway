export type TransferStatus =
  | "pending_payment"
  | "payment_proof_uploaded"
  | "payment_confirmed"
  | "waiting_recipient"
  | "ready_to_send"
  | "rub_sent"
  | "completed"
  | "rejected";

export type PaymentMethod =
  | "vodafone_cash"
  | "instapay"
  | string;

export interface Transfer {
  id: number;
  quote_id: string | null;

  rub_amount?: number;
  egp_amount?: number;
  amount_rub?: number;
  amount_egp?: number;

  payment_method?: PaymentMethod;
  status: TransferStatus;

  customer_name?: string | null;
  customer_phone?: string | null;
  telegram_username?: string | null;

  receipt_path?: string | null;
  receipt_url?: string | null;

  rejection_reason?: string | null;

  created_at?: string;
  updated_at?: string | null;
}

export interface TransferStatistics {
  total: number;
  pending: number;
  receiptUploaded: number;
  approved: number;
  completed: number;
  rejected: number;
}