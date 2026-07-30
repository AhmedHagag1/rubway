import type {
  TransferStatistics,
} from "@/types/transfer";


interface StatisticsCardsProps {
  statistics: TransferStatistics;
}


const cards = [
  {
    key: "total",
    label: "Total transfers",
    description: "All requests",
  },
  {
    key: "pending",
    label: "Pending",
    description: "Waiting for payment",
  },
  {
    key: "receiptUploaded",
    label: "Receipts",
    description: "Need review",
  },
  {
    key: "approved",
    label: "Approved",
    description: "Ready to complete",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Successfully finished",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Declined requests",
  },
] as const;


export default function StatisticsCards({
  statistics,
}: StatisticsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.key}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-semibold text-slate-500">
            {card.label}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {statistics[card.key]}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {card.description}
          </p>
        </article>
      ))}
    </div>
  );
}