export function formatRs(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
