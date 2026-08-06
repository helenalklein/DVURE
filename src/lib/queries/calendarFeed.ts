import { supabase } from "../supabaseClient";

export async function fetchCalendarFeedToken(orgId: string): Promise<string | null> {
  const { data, error } = await supabase.from("organizations").select("calendar_feed_token").eq("id", orgId).maybeSingle();
  if (error || !data) return null;
  return (data as any).calendar_feed_token as string;
}

// Self-editable like `name` (0019/0040) — any org admin can rotate it if
// a link ever leaks, same as regenerating a Google/Apple private
// calendar address.
export async function regenerateCalendarFeedToken(orgId: string): Promise<{ token: string | null; error: string | null }> {
  const token = crypto.randomUUID();
  const { error } = await supabase.from("organizations").update({ calendar_feed_token: token }).eq("id", orgId);
  if (error) return { token: null, error: error.message };
  return { token, error: null };
}

// A dvure.com URL, not the underlying Supabase project's own domain —
// vercel.json proxies /calendar/:token.ics through to the real ics-feed
// function so the link a user pastes into Apple/Google Calendar reads as
// this product, not its infrastructure. Only resolves once deployed;
// there's no equivalent rewrite layer in the local Vite dev server.
export function icsFeedUrls(token: string): { httpsUrl: string; webcalUrl: string } {
  const httpsUrl = `https://dvure.com/calendar/${token}.ics`;
  const webcalUrl = `webcal://dvure.com/calendar/${token}.ics`;
  return { httpsUrl, webcalUrl };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function dateStamp(iso: string) { const [y, m, d] = iso.split("-").map(Number); return `${y}${pad(m)}${pad(d)}`; }
function addDay(iso: string) { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }

// Opens Google Calendar's own "add event" form pre-filled — no auth,
// no backend, the user just confirms and saves it themselves.
export function googleCalendarUrl(params: { title: string; date: string }): string {
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${dateStamp(params.date)}/${addDay(params.date)}`,
  });
  return `https://calendar.google.com/calendar/render?${qs.toString()}`;
}

// Single-event .ics download for Apple Calendar/Outlook — no backend,
// works the instant it's clicked. Complements the live subscribable
// feed (icsFeedUrls) which syncs every event going forward instead of
// just this one.
export function downloadEventIcs(params: { title: string; date: string }) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escaped = params.title.replace(/([,;\\])/g, "\\$1");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DVURE//Schedule//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@dvure`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateStamp(params.date)}`,
    `DTEND;VALUE=DATE:${addDay(params.date)}`,
    `SUMMARY:${escaped}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
