import type { RiskLevel } from "@/lib/engine/types";

const STYLES: Record<RiskLevel, string> = {
  Low: "text-low bg-low/10 ring-low/25",
  Medium: "text-medium bg-medium/10 ring-medium/25",
  High: "text-high bg-high/10 ring-high/25",
};

export function RiskBadge({ level, reasons = [] }: { level: RiskLevel; reasons?: string[] }) {
  return (
    <span
      title={reasons.length ? reasons.join(". ") + "." : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STYLES[level]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {level} risk
    </span>
  );
}
