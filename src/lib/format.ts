const numberFormat = new Intl.NumberFormat("en-US");

export function formatClue(km: number | null): string {
  if (km === null) return "Distance unknown";
  if (km === 0) return "Shares a border!";
  return `Closest border: ${numberFormat.format(km)} km`;
}
