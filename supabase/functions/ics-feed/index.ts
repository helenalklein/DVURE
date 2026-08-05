// Serves a live .ics feed of every shoot day + casting across an org's
// campaigns, for subscribing in Apple Calendar / Google Calendar. Called
// directly by calendar apps polling a URL on their own schedule — there
// is no interactive session to check, so the token in the query string
// IS the auth (see 0040_calendar_feed_token.sql's own comment on why
// that's the right posture here, same as Google/Apple's own private
// "secret address" calendar links). verify_jwt is disabled for this
// function in config.toml for exactly that reason.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function pad(n: number) { return String(n).padStart(2, "0"); }

function dateStamp(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}${pad(m)}${pad(d)}`;
}

function addDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// RFC5545 §3.3.11 — commas, semicolons, backslashes and newlines are
// structurally significant in ICS text values and must be escaped.
function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function foldLine(line: string) {
  // §3.1 — lines over 75 octets must be folded with a leading space
  // continuation, or some clients (notably older Outlook) truncate them.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("Missing token", { status: 400, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("calendar_feed_token", token)
    .maybeSingle();
  if (orgErr || !org) {
    return new Response("Invalid calendar link", { status: 404, headers: corsHeaders });
  }

  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, name")
    .eq("brand_org_id", org.id);
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const campaignName = new Map((campaigns ?? []).map((c) => [c.id, c.name]));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DVURE//Schedule//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(org.name)} — DVURE Schedule`,
  ];

  if (campaignIds.length > 0) {
    const [{ data: shoots }, { data: castings }] = await Promise.all([
      supabaseAdmin.from("shoot_days").select("id, campaign_id, event_date, description, talent_note")
        .in("campaign_id", campaignIds).not("event_date", "is", null),
      supabaseAdmin.from("castings").select("id, campaign_id, event_date, title")
        .in("campaign_id", campaignIds),
    ]);

    const now = new Date();
    const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    for (const s of (shoots ?? [])) {
      const cName = campaignName.get(s.campaign_id) ?? "Campaign";
      const summary = `${cName}: ${s.description || s.talent_note || "Shoot day"}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:shoot-${s.id}@dvure`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dateStamp(s.event_date)}`,
        `DTEND;VALUE=DATE:${addDay(s.event_date)}`,
        foldLine(`SUMMARY:${escapeText(summary)}`),
        "END:VEVENT"
      );
    }
    for (const c of (castings ?? [])) {
      const cName = campaignName.get(c.campaign_id) ?? "Campaign";
      const summary = `${cName}: ${c.title || "Casting"}`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:casting-${c.id}@dvure`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dateStamp(c.event_date)}`,
        `DTEND;VALUE=DATE:${addDay(c.event_date)}`,
        foldLine(`SUMMARY:${escapeText(summary)}`),
        "END:VEVENT"
      );
    }
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { ...corsHeaders, "Content-Type": "text/calendar; charset=utf-8" },
    status: 200,
  });
});
