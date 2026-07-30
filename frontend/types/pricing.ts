export type PricingSettings = {
  instapay_rate: number | string;
  vodafone_rate: number | string;
  updated_at: string;
};

export type PricingUpdate = {
  instapay_rate: number;
  vodafone_rate: number;
};
