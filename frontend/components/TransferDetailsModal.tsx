"use client";

import { useEffect } from "react";

import ActionButtons from "@/components/ActionButtons";
import StatusBadge from "@/components/StatusBadge";

import type { Transfer } from "@/types/transfer";

interface TransferDetailsModalProps {
  transfer: Transfer | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "") ??
  "http://127.0.0.1:8000";

function getRubAmount(transfer: Transfer): number | null {
  return transfer.rub_amount ?? transfer.amount_rub ?? null;
}

function getEgpAmount(transfer: Transfer): number | null {
  return transfer.egp_amount ?? transfer.amount_egp ?? null;
}

function formatAmount(value: number | null, currency: string): string {
  if (value === null) {
    return "—";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPaymentMethod(value?: string): string {
  if (!value) {
    return "—";
  }

  if (value.toLowerCase() === "vodafone_cash") {
    return "Vodafone Cash";
  }

  if (value.toLowerCase() === "instapay") {
    return "InstaPay";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReceiptUrl(transfer: Transfer): string | null {
  const value = transfer.receipt_url ?? transfer.receipt_path;

  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  return `${API_ORIGIN}${normalizedPath}`;
}

function getWhatsAppUrl(phone?: string | null): string | null {
  if (!phone) {
    return null;
  }

  const normalizedPhone = phone.replace(/[^\d]/g, "");

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}`;
}

function getTelegramUrl(username?: string | null): string | null {
  if (!username) {
    return null;
  }

  const normalizedUsername = username.replace(/^@/, "").trim();

  if (!normalizedUsername) {
    return null;
  }

  return `https://t.me/${normalizedUsername}`;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <div className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function TransferDetailsModal({
  transfer,
  onClose,
  onRefresh,
}: TransferDetailsModalProps) {
  useEffect(() => {
    if (!transfer) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [transfer, onClose]);

  if (!transfer) {
    return null;
  }

  const receiptUrl = getReceiptUrl(transfer);

console.log("Receipt URL:", receiptUrl);
  const whatsappUrl = getWhatsAppUrl(transfer.customer_phone);
  const telegramUrl = getTelegramUrl(transfer.telegram_username);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">
              RUBWAY Transfer
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-950">
                Transfer #{transfer.id}
              </h2>

              <StatusBadge status={transfer.status} />
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close transfer details"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            ×
          </button>
        </header>

        <div className="space-y-8 p-5 sm:p-7">
          <section>
            <h3 className="text-lg font-bold text-slate-950">
              Transfer information
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem
                label="RUB amount"
                value={formatAmount(getRubAmount(transfer), "RUB")}
              />

              <DetailItem
                label="EGP amount"
                value={formatAmount(getEgpAmount(transfer), "EGP")}
              />

              <DetailItem
                label="Payment method"
                value={formatPaymentMethod(transfer.payment_method)}
              />

              <DetailItem
                label="Created"
                value={formatDate(transfer.created_at)}
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailItem
                label="Quote ID"
                value={transfer.quote_id ?? "Legacy transfer"}
              />

              <DetailItem
                label="Last update"
                value={formatDate(transfer.updated_at)}
              />
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-950">
                Customer
              </h3>

              <div className="flex flex-wrap gap-2">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    WhatsApp
                  </a>
                )}

                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600"
                  >
                    Telegram
                  </a>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <DetailItem
                label="Customer name"
                value={transfer.customer_name ?? "Unknown customer"}
              />

              <DetailItem
                label="Phone"
                value={transfer.customer_phone ?? "Not provided"}
              />

              <DetailItem
                label="Telegram"
                value={transfer.telegram_username ?? "Not provided"}
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-950">
              Payment receipt
            </h3>

            {receiptUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Uploaded receipt
                  </p>

                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-emerald-700 hover:underline"
                  >
                    Open full size
                  </a>
                </div>

                <div className="flex min-h-64 items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt={`Receipt for transfer ${transfer.id}`}
                    className="max-h-[520px] max-w-full rounded-xl object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <p className="font-bold text-slate-700">
                  No receipt uploaded
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  The customer has not uploaded a payment receipt yet.
                </p>
              </div>
            )}
          </section>

          {transfer.rejection_reason && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Rejection reason
              </p>

              <p className="mt-2 text-sm leading-6 text-red-800">
                {transfer.rejection_reason}
              </p>
            </section>
          )}

          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-950">
                Transfer actions
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Update the request after checking the payment information.
              </p>
            </div>

            <ActionButtons
              transfer={transfer}
              onUpdated={async () => {
                await onRefresh();
                onClose();
              }}
            />
          </section>
        </div>
      </section>
    </div>
  );
}