// Displays a campaign due date as "Mon D" — or "Mon D, YYYY" once it's
// more than a year out, dropping the year again the moment the calendar
// reaches January 1st of that due year (at which point "this year" is
// implied and the date reads unambiguously without it).
export function formatCampaignDue(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  // Built from Y/M/D parts rather than `new Date(iso)` — a bare
  // "YYYY-MM-DD" string parses as UTC midnight, which rolls back a day
  // once toLocaleDateString renders it in any timezone behind UTC.
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const oneYearOut = new Date(now);
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  const showYear = due.getFullYear() > now.getFullYear() && due > oneYearOut;
  return due.toLocaleDateString("en-US", showYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric" });
}
