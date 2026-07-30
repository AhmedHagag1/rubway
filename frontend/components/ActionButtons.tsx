"use client";

import { useState } from "react";

import {
  ApiError,
  completeTransfer,
  confirmPayment,
  markRubSent,
  rejectTransfer,
} from "@/lib/api";

import type {
  Transfer,
} from "@/types/transfer";


interface ActionButtonsProps {
  transfer: Transfer;
  onUpdated: () => Promise<void>;
}


type TransferAction =
  | "confirm_payment"
  | "mark_rub_sent"
  | "complete"
  | "reject";


function getActionLabel(
  action: TransferAction,
): string {
  if (action === "confirm_payment") {
    return "confirm the payment for";
  }

  if (action === "mark_rub_sent") {
    return "mark RUB as sent for";
  }

  if (action === "complete") {
    return "complete";
  }

  return "reject";
}


export default function ActionButtons({
  transfer,
  onUpdated,
}: ActionButtonsProps) {
  const [
    loadingAction,
    setLoadingAction,
  ] = useState<TransferAction | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState("");

  async function runAction(
    action: TransferAction,
  ) {
    let rejectionReason:
      | string
      | undefined;

    if (action === "reject") {
      const reason = window.prompt(
        `Enter a rejection reason for transfer #${transfer.id}:`,
      );

      if (reason === null) {
        return;
      }

      const normalizedReason =
        reason.trim();

      if (
        normalizedReason.length > 0 &&
        normalizedReason.length < 3
      ) {
        setError(
          "Rejection reason must contain at least 3 characters.",
        );
        return;
      }

      rejectionReason =
        normalizedReason || undefined;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${getActionLabel(action)} transfer #${transfer.id}?`,
    );

    if (!confirmed) {
      return;
    }

    setLoadingAction(action);
    setError("");

    try {
      if (
        action === "confirm_payment"
      ) {
        await confirmPayment(
          transfer.id,
        );
      }

      if (
        action === "mark_rub_sent"
      ) {
        await markRubSent(
          transfer.id,
        );
      }

      if (
        action === "complete"
      ) {
        await completeTransfer(
          transfer.id,
        );
      }

      if (
        action === "reject"
      ) {
        await rejectTransfer(
          transfer.id,
          rejectionReason,
        );
      }

      await onUpdated();
    } catch (requestError) {
      if (
        requestError instanceof ApiError
      ) {
        setError(
          requestError.message,
        );
      } else {
        setError(
          "Could not update transfer.",
        );
      }
    } finally {
      setLoadingAction(null);
    }
  }


  const isLoading =
    loadingAction !== null;

  if (
    transfer.status === "completed" ||
    transfer.status === "rejected"
  ) {
    return (
      <span className="text-xs font-semibold text-slate-400">
        No actions
      </span>
    );
  }


  return (
    <div className="min-w-44">
      <div className="flex flex-wrap gap-2">
        {transfer.status ===
          "pending_payment" && (
          <span className="text-xs font-semibold text-amber-600">
            Waiting for payment receipt
          </span>
        )}

        {transfer.status ===
          "payment_proof_uploaded" && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void runAction(
                "confirm_payment",
              )
            }
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction ===
            "confirm_payment"
              ? "Confirming..."
              : "Confirm payment"}
          </button>
        )}

        {transfer.status ===
          "waiting_recipient" && (
          <span className="text-xs font-semibold text-violet-600">
            Waiting for recipient details
          </span>
        )}

        {transfer.status ===
          "ready_to_send" && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void runAction(
                "mark_rub_sent",
              )
            }
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction ===
            "mark_rub_sent"
              ? "Updating..."
              : "Mark RUB sent"}
          </button>
        )}

        {transfer.status ===
          "rub_sent" && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void runAction(
                "complete",
              )
            }
            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction ===
            "complete"
              ? "Completing..."
              : "Complete"}
          </button>
        )}

        {transfer.status ===
          "payment_confirmed" && (
          <span className="text-xs font-semibold text-violet-600">
            Payment confirmed
          </span>
        )}

        {![
          "completed",
          "rejected",
        ].includes(
          transfer.status,
        ) && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() =>
              void runAction(
                "reject",
              )
            }
            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction ===
            "reject"
              ? "Rejecting..."
              : "Reject"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 max-w-64 text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}