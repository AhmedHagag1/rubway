export type PaymentAccountType = "vodafone" | "instapay";

export type NumericValue = number | string;

export interface PaymentAccount {
  id: number;
  name: string;
  account_type: PaymentAccountType;
  account_number: string;
  masked_account_number: string;
  account_holder_name: string;
  daily_limit: NumericValue;
  monthly_limit: NumericValue;
  warning_threshold: NumericValue;
  critical_threshold: NumericValue;
  is_active: boolean;
  priority: number;
  used_today: NumericValue;
  remaining_today: NumericValue;
  used_this_month: NumericValue;
  remaining_this_month: NumericValue;
  daily_usage_percent: NumericValue;
  monthly_usage_percent: NumericValue;
  created_at: string;
  updated_at: string;
}

export interface PaymentAccountCreate {
  name: string;
  account_type: PaymentAccountType;
  account_number: string;
  account_holder_name: string;
  daily_limit: number;
  monthly_limit: number;
  warning_threshold: number;
  critical_threshold: number;
  is_active: boolean;
  priority: number;
}

export type PaymentAccountUpdate = Partial<
  Omit<PaymentAccountCreate, "account_type">
>;
