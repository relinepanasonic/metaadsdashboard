// Display formatters (IDR currency, compact numbers, percentages).

export function formatIDR(n: number, compact = true): string {
  if (compact) {
    return "Rp " + compactNumber(n);
  }
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

export function formatPct(fraction: number, dp = 1): string {
  return (fraction * 100).toFixed(dp) + "%";
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}
