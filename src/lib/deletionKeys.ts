// A milk record is all of one cow's sessions for a day, so a delete request names it as "<cowId or blank for a herd total>|<yyyy-mm-dd>".
// Pure, so it is tested without a database.

export const milkingKey = (cowId: string | null, date: string) => `${cowId ?? ""}|${date}`;

export function parseMilkingKey(key: string): { cowId: string | null; date: Date } | null {
  const [cow, d] = key.split("|");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return null;
  return { cowId: cow ? cow : null, date: new Date(`${d}T00:00:00.000Z`) };
}
