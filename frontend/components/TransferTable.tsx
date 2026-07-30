"use client";

import { useMemo, useState } from "react";

import ActionButtons from "@/components/ActionButtons";
import StatusBadge from "@/components/StatusBadge";
import TransferDetailsModal from "@/components/TransferDetailsModal";

import type { Transfer, TransferStatus } from "@/types/transfer";

interface TransferTableProps {
  transfers: Transfer[];
  onRefresh: () => Promise<void>;
}

type StatusFilter = "all" | TransferStatus;

function getRubAmount(transfer: Transfer): number | null {
  return transfer.rub_amount ?? transfer.amount_rub ?? null;
}

function getEgpAmount(transfer: Transfer): number | null {
  return transfer.egp_amount ?? transfer.amount_egp ?? null;
}

function formatNumber(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPaymentMethod(method?: string): string {
  if (!method) {
    return "—";
  }

  const normalized = method.toLowerCase();

  if (normalized === "vodafone_cash") {
    return "Vodafone Cash";
  }

  if (normalized === "instapay") {
    return "InstaPay";
  }

  return method
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function TransferTable({
  transfers,
  onRefresh,
}: TransferTableProps) {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTransfer, setSelectedTransfer] =
    useState<Transfer | null>(null);

  const filteredTransfers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return transfers.filter((transfer) => {
      const matchesStatus =
        statusFilter === "all" || transfer.status === statusFilter;

      const searchableText = [
        transfer.id,
        transfer.quote_id,
        transfer.customer_name,
        transfer.customer_phone,
        transfer.telegram_username,
        transfer.payment_method,
        transfer.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedQuery || searchableText.includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });
  }, [transfers, statusFilter, searchQuery]);

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Transfers
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review and manage customer transfer requests.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search ID, phone or quote..."
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 sm:w-72"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="receipt_uploaded">Receipt uploaded</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold text-slate-400">
            Showing {filteredTransfers.length} of {transfers.length} transfers
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Transfer
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Customer
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  RUB
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  EGP
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Method
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Created
                </th>

                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50/80"
                >
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-950">
                      #{transfer.id}
                    </p>

                    <p
                      title={transfer.quote_id ?? undefined}
                      className="mt-1 max-w-40 truncate text-xs text-slate-400"
                    >
                      {transfer.quote_id ?? "Legacy transfer"}
                    </p>
                  </td>

                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-800">
                      {transfer.customer_name ?? "Unknown customer"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {transfer.customer_phone ??
                        transfer.telegram_username ??
                        "No contact information"}
                    </p>
                  </td>

                  <td className="px-6 py-5 font-bold text-slate-900">
                    {formatNumber(getRubAmount(transfer))} RUB
                  </td>

                  <td className="px-6 py-5 font-bold text-slate-900">
                    {formatNumber(getEgpAmount(transfer))} EGP
                  </td>

                  <td className="px-6 py-5 text-sm font-semibold text-slate-700">
                    {formatPaymentMethod(transfer.payment_method)}
                  </td>

                  <td className="px-6 py-5">
                    <StatusBadge status={transfer.status} />
                  </td>

                  <td className="px-6 py-5 text-sm text-slate-500">
                    {formatDate(transfer.created_at)}
                  </td>

                  <td className="px-6 py-5">
                    <div className="flex min-w-48 flex-col items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTransfer(transfer)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                      >
                        View details
                      </button>

                      <ActionButtons
                        transfer={transfer}
                        onUpdated={onRefresh}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransfers.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
              📭
            </div>

            <h3 className="mt-4 font-bold text-slate-900">
              No transfers found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try changing the search or status filter.
            </p>
          </div>
        )}
      </section>

      <TransferDetailsModal
        transfer={selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        onRefresh={onRefresh}
      />
    </>
  );
}