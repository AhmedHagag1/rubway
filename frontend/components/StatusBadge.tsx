import type {
  TransferStatus,
} from "@/types/transfer";


interface StatusBadgeProps {
  status: TransferStatus;
}


const statusConfig: Record<
  TransferStatus,
  {
    label: string;
    classes: string;
    dot: string;
  }
> = {
  pending_payment: {
    label: "Pending payment",
    classes:
      "border-amber-200 bg-amber-50 text-amber-700",
    dot:
      "bg-amber-500",
  },

  payment_proof_uploaded: {
    label: "Payment proof uploaded",
    classes:
      "border-blue-200 bg-blue-50 text-blue-700",
    dot:
      "bg-blue-500",
  },

  payment_confirmed: {
    label: "Payment confirmed",
    classes:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
    dot:
      "bg-cyan-500",
  },

  waiting_recipient: {
    label: "Waiting recipient",
    classes:
      "border-violet-200 bg-violet-50 text-violet-700",
    dot:
      "bg-violet-500",
  },

  ready_to_send: {
    label: "Ready to send",
    classes:
      "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot:
      "bg-indigo-500",
  },

  rub_sent: {
    label: "RUB sent",
    classes:
      "border-sky-200 bg-sky-50 text-sky-700",
    dot:
      "bg-sky-500",
  },

  completed: {
    label: "Completed",
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot:
      "bg-emerald-500",
  },

  rejected: {
    label: "Rejected",
    classes:
      "border-red-200 bg-red-50 text-red-700",
    dot:
      "bg-red-500",
  },
};


export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config =
    statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${config.classes}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${config.dot}`}
      />

      {config.label}
    </span>
  );
}