// Who recorded a cash transaction and when. The time is the farm's local time (Asia/Karachi), stored as
// "HH:MM:SS" next to the date, the same way the CashBook entries carry it.
export function farmTimeNow(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
}

export function cashStamp(user: { id: string; name: string }) {
  return { time: farmTimeNow(), enteredBy: user.name, createdById: user.id };
}

/** "17:35:00" -> "05:35 PM" */
export function formatClock(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
