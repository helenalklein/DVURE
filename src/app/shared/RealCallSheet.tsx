import { useEffect, useState } from "react";
import { MapPin, Car, Cross, CloudSun, Clock, Plus, X, Phone, Mail, Star, Printer } from "lucide-react";
import { cx, Btn, TextInput } from "./ui";
import { fetchMyCallSheetRole, type CallSheetPermission } from "../../lib/queries/callSheet";
import {
  fetchShootDays, fetchCallSheet, saveCallSheetDetails, saveCallSheetSchedule, fetchCallSheetContacts,
  type ShootDaySummary, type CallSheetDetails, type CallSheetScheduleItem, type CallSheetContact,
} from "../../lib/queries/shootDayCallSheet";

// The real, industry-format call sheet — one per shoot day (a 3-day
// shoot has 3 different locations/schedules/call times, not one),
// distinct from the Crew tab's staffing roster (CallSheet.tsx). Contact
// list is derived live from the same staffing grid, not re-entered here
// — the only things anyone actually types are the shoot-day-specific
// logistics (location, weather, schedule) nothing else already knows.
//
// `new Date("2026-08-18")` parses as UTC midnight; toLocaleDateString()
// then renders it in the browser's local timezone, which silently
// shifts it back a day for anyone west of UTC. Parsing the Y-M-D parts
// directly into a local-midnight Date sidesteps that.
function formatDayLabel(d: ShootDaySummary): string {
  let date = "";
  if (d.eventDate) {
    const [y, m, day] = d.eventDate.slice(0, 10).split("-").map(Number);
    date = new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return [d.dateLabel, date].filter(Boolean).join(" — ") || "Shoot day";
}

const EMPTY_DETAILS = { locationName: "", address: "", parkingNotes: "", nearestHospital: "", weather: "", crewCallTime: "" };

export default function RealCallSheet({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [shootDays, setShootDays] = useState<ShootDaySummary[] | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [details, setDetails] = useState<CallSheetDetails | null>(null);
  const [contacts, setContacts] = useState<CallSheetContact[]>([]);
  const [myRole, setMyRole] = useState<CallSheetPermission>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_DETAILS);
  const [schedule, setSchedule] = useState<CallSheetScheduleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const canEdit = myRole === "admin" || myRole === "producer";

  useEffect(() => {
    let active = true;
    fetchShootDays(campaignId).then(days => {
      if (!active) return;
      setShootDays(days);
      setSelectedDayId(prev => prev ?? days[0]?.id ?? null);
    });
    fetchMyCallSheetRole(campaignId).then(r => { if (active) setMyRole(r); });
    fetchCallSheetContacts(campaignId).then(c => { if (active) setContacts(c); });
    return () => { active = false; };
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setEditing(false);
    if (!selectedDayId) return;
    fetchCallSheet(selectedDayId).then(d => {
      if (!active) return;
      setDetails(d);
      setForm(d ? { locationName: d.locationName, address: d.address, parkingNotes: d.parkingNotes, nearestHospital: d.nearestHospital, weather: d.weather, crewCallTime: d.crewCallTime } : EMPTY_DETAILS);
      setSchedule(d?.schedule ?? []);
    });
    return () => { active = false; };
  }, [selectedDayId]);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => { window.print(); setPrinting(false); }, 60);
    return () => clearTimeout(t);
  }, [printing]);

  async function handleSave() {
    if (!selectedDayId) return;
    setSaving(true);
    const { callSheetId, error } = await saveCallSheetDetails({ shootDayId: selectedDayId, ...form });
    if (!error && callSheetId) {
      await saveCallSheetSchedule(callSheetId, schedule.filter(s => s.time.trim() || s.label.trim()));
      const refreshed = await fetchCallSheet(selectedDayId);
      setDetails(refreshed);
      setSchedule(refreshed?.schedule ?? []);
      setEditing(false);
    }
    setSaving(false);
  }

  const contactsByCategory = new Map<string, CallSheetContact[]>();
  for (const c of contacts) contactsByCategory.set(c.category, [...(contactsByCategory.get(c.category) ?? []), c]);

  const selectedDay = shootDays?.find(d => d.id === selectedDayId);

  if (shootDays === null) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (shootDays.length === 0) return <div className="p-6 text-sm text-muted-foreground">No shoot days on this campaign yet — add one from Deliverables to build a call sheet.</div>;

  return (
    <div data-print-mode={printing ? "call-sheet" : undefined} className="call-sheet-root h-full overflow-auto p-6 space-y-5">
      <div className="call-sheet-noprint flex items-center justify-between gap-3">
        <div>
          <div className="text-heading text-lg">{campaignName} — Call Sheet</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {shootDays.map(d => (
              <button key={d.id} onClick={()=>setSelectedDayId(d.id)}
                className={cx("text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors",
                  selectedDayId===d.id ? "bg-foreground text-primary-foreground border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                )}>{formatDayLabel(d)}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {details && <Btn variant="outline" size="sm" icon={<Printer size={13}/>} onClick={()=>setPrinting(true)}>Print</Btn>}
          {canEdit && !editing && (
            <Btn variant="outline" size="sm" onClick={()=>setEditing(true)}>Edit</Btn>
          )}
        </div>
      </div>

      {/* Print header — visible only when printing */}
      <div className="hidden print:block">
        <div className="text-lg font-semibold">{campaignName} — Call Sheet</div>
        <div className="text-xs text-muted-foreground">{selectedDay ? formatDayLabel(selectedDay) : ""}</div>
      </div>

      {editing ? (
        <div className="call-sheet-noprint glass-subtle border rounded-md p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Location name" value={form.locationName} onChange={e=>setForm(f=>({...f, locationName:e.target.value}))} placeholder="Studio 9"/>
            <TextInput label="Address" value={form.address} onChange={e=>setForm(f=>({...f, address:e.target.value}))} placeholder="123 Broadway, New York, NY"/>
            <TextInput label="Parking" value={form.parkingNotes} onChange={e=>setForm(f=>({...f, parkingNotes:e.target.value}))} placeholder="Street parking on 5th Ave"/>
            <TextInput label="Nearest hospital" value={form.nearestHospital} onChange={e=>setForm(f=>({...f, nearestHospital:e.target.value}))} placeholder="NYU Langone — 550 1st Ave"/>
            <TextInput label="Weather" value={form.weather} onChange={e=>setForm(f=>({...f, weather:e.target.value}))} placeholder="Sunny, 65°F"/>
            <TextInput label="Crew call time" value={form.crewCallTime} onChange={e=>setForm(f=>({...f, crewCallTime:e.target.value}))} placeholder="7:00 AM"/>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5">Schedule</div>
            <div className="space-y-1.5">
              {schedule.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={s.time} onChange={e=>setSchedule(prev=>prev.map((p,pi)=>pi===i?{...p,time:e.target.value}:p))}
                    placeholder="7:00 AM" className="w-28 px-2 py-1.5 text-xs border border-border rounded-md bg-input-background focus:outline-none"/>
                  <input value={s.label} onChange={e=>setSchedule(prev=>prev.map((p,pi)=>pi===i?{...p,label:e.target.value}:p))}
                    placeholder="Crew call" className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md bg-input-background focus:outline-none"/>
                  <button onClick={()=>setSchedule(prev=>prev.filter((_,pi)=>pi!==i))} className="text-muted-foreground hover:text-foreground shrink-0"><X size={13}/></button>
                </div>
              ))}
              <button onClick={()=>setSchedule(prev=>[...prev, { time:"", label:"" }])}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                <Plus size={11}/> Add row
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Btn variant="outline" size="sm" onClick={()=>{ setEditing(false); setForm(details ? { locationName:details.locationName, address:details.address, parkingNotes:details.parkingNotes, nearestHospital:details.nearestHospital, weather:details.weather, crewCallTime:details.crewCallTime } : EMPTY_DETAILS); setSchedule(details?.schedule ?? []); }}>Cancel</Btn>
            <Btn variant="primary" size="sm" disabled={saving} onClick={handleSave}>{saving ? "Saving…" : "Save"}</Btn>
          </div>
        </div>
      ) : !details ? (
        <div className="call-sheet-noprint glass-subtle border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground">
          {canEdit ? "No call sheet filled in for this day yet — click Edit to start one." : "No call sheet filled in for this day yet."}
        </div>
      ) : (
        <>
          <div className="glass-subtle border rounded-md p-4 grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-4">
            <div className="flex items-start gap-2">
              <MapPin size={13} className="text-muted-foreground shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Location</div>
                <div className="text-sm font-medium">{details.locationName || "Not set"}</div>
                <div className="text-xs text-muted-foreground">{details.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Car size={13} className="text-muted-foreground shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Parking</div>
                <div className="text-sm">{details.parkingNotes || "Not set"}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Cross size={13} className="text-muted-foreground shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Nearest hospital</div>
                <div className="text-sm">{details.nearestHospital || "Not set"}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CloudSun size={13} className="text-muted-foreground shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Weather</div>
                <div className="text-sm">{details.weather || "Not set"}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={13} className="text-muted-foreground shrink-0 mt-0.5"/>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Crew call</div>
                <div className="text-sm font-medium">{details.crewCallTime || "Not set"}</div>
              </div>
            </div>
          </div>

          {schedule.length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-2">Schedule</div>
              <div className="glass-subtle border rounded-md divide-y divide-border">
                {schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <div className="text-xs font-mono font-medium w-20 shrink-0">{s.time}</div>
                    <div className="text-sm">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-2">Contact list</div>
        {contacts.length === 0 ? (
          <div className="text-xs text-muted-foreground">No crew assigned yet — staff the Crew tab first.</div>
        ) : (
          <div className="space-y-3">
            {[...contactsByCategory.entries()].map(([category, people]) => (
              <div key={category} className="break-inside-avoid">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">{category.replace(/_/g, " ")}</div>
                <div className="grid grid-cols-2 print:grid-cols-2 gap-2">
                  {people.map((p, i) => (
                    <div key={i} className="glass-subtle border rounded-md px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center gap-1">
                          {p.name} {p.isDepartmentLead && <Star size={9} className="fill-foreground text-foreground shrink-0"/>}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{p.roleKey.replace(/_/g, " ")}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Phone size={9}/> {p.phone || "Not set"}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end truncate">
                          <Mail size={9}/> {p.email || "Not set"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
