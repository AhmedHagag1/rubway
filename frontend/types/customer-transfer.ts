export type PaymentMethod = "vodafone" | "instapay";

export type CustomerTransferStatus =
  | "pending_payment"
  | "payment_proof_uploaded"
  | "payment_confirmed"
  | "waiting_recipient"
  | "ready_to_send"
  | "rub_sent"
  | "completed"
  | "rejected";

export interface TransferQuoteRequest {
  rub_amount: string | null;
  egp_amount: string | null;
  payment_method: PaymentMethod;
}

export interface TransferQuote {
  quote_id: string;
  rub_amount: string;
  egp_amount: string;
  exchange_rate: string;
  payment_method: PaymentMethod;
  created_at: string;
  expires_at: string;
  valid_for_seconds: number;
}

export interface CreateCustomerTransferRequest {
  quote_id: string;
  customer_name: string;
  customer_phone: string;
  telegram_username: string | null;
  recipient: RussianRecipientCreate;
}

export interface RussianRecipientCreate {
  recipient_name: string;
  bank_name: string;
  recipient_phone: string;
  card_number: string | null;
  account_number: string | null;
  sbp_phone: string | null;
}

export interface RussianRecipient extends RussianRecipientCreate {
  id?: number;
  transfer_id?: number;
  created_at?: string;
  updated_at?: string | null;
}


export interface CustomerPaymentAccount {
  id: number;
  name: string;
  account_type: PaymentMethod;
  account_number: string;
  account_holder_name: string;
}

export interface CustomerTransfer {
  id: number;
  quote_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  telegram_username: string | null;
  rub_amount: string;
  egp_amount: string;
  exchange_rate: string;
  payment_method: PaymentMethod;
  payment_account_id?: number | null;
  payment_account?: CustomerPaymentAccount | null;
  status: CustomerTransferStatus;
  receipt_path: string | null;
  receipt_url?: string | null;
  russian_recipient?: RussianRecipient | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ReceiptUploadResponse {
  transfer_id: number;
  status: CustomerTransferStatus;
  receipt_path: string;
  message: string;
}

export interface TransferTracking {
  transfer_id: number;
  customer_phone: string | null;
  rub_amount: string;
  egp_amount: string;
  payment_method: PaymentMethod;
  payment_account_id?: number | null;
  payment_account?: CustomerPaymentAccount | null;
  status: CustomerTransferStatus;
  has_receipt: boolean;
  has_recipient_details: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}