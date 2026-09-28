/** Beginner-friendly number formatting. */

export function pct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function usd(amount: number, digits = 0): string {
  // Avoid "-$0" for tiny negatives that round to zero.
  const sign = amount < 0 && Math.abs(amount) >= 0.5 * 10 ** -digits ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function signedUsd(amount: number): string {
  return amount >= 0 ? `+${usd(amount)}` : usd(amount);
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
