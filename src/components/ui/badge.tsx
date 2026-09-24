import { cn } from "@/lib/utils";

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-800 ring-blue-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type Tone = keyof typeof TONES;

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  COMPLETED: "blue",
  DEFAULTED: "red",
  RESTRUCTURED: "violet",
  SUSPENDED: "amber",
  INACTIVE: "gray",
  PENDING: "amber",
  REJECTED: "red",
  CONFIRMED: "green",
};

export function Badge({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONES[tone ?? "gray"],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{status.replace(/_/g, " ")}</Badge>;
}
