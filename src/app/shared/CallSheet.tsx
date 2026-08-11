import { useEffect, useMemo, useState } from "react";
import { Printer, Plus, X, Search, ChevronDown, Lock, Star } from "lucide-react";
import { cx, Btn, Modal, TextInput } from "./ui";
import { CALL_SHEET_CATEGORIES } from "./callSheetRoles";
import { useAuth } from "./auth";
import {
  fetchCallSheetSlots, fetchCrewDirectory, fetchMyCallSheetRole, assignCallSheetRole, clearCallSheetRole,
  inviteCrewToCallSheet, setDepartmentLead, updateCrewSlotRate,
  type CallSheetAssignment, type CrewDirectoryEntry, type CallSheetPermission,
} from "../../lib/queries/callSheet";

// Shared by both tabs below — Crew (assign/manage) and Call Sheet
// (view/print) read the exact same underlying slots, just render and
// gate them differently. Splitting this out avoids fetching/deriving
// the same data twice when a campaign workspace ever needs both
// mounted at once (it doesn't today, but keeps them decoupled).
function useCallSheetData(campaignId: string) {
  const [assignments, setAssignments] = useState<Map<string, CallSheetAssignment>>(new Map());
  const [directory, setDirectory] = useState<CrewDirectoryEntry[]>([]);
  const [myRole, setMyRole] = useState<CallSheetPermission>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [slots, dir, role] = await Promise.all([fetchCallSheetSlots(campaignId), fetchCrewDirectory(), fetchMyCallSheetRole(campaignId)]);
    setAssignments(new Map(slots.map((s) => [s.roleKey, s])));
    setDirectory(dir);
    setMyRole(role);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [campaignId]);

  const roleKeyToCategory = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of CALL_SHEET_CATEGORIES) for (const r of cat.roles) m.set(r.key, cat.key);
    return m;
  }, []);

  const filledCount = assignments.size;
  const totalRoles = useMemo(() => CALL_SHEET_CATEGORIES.reduce((n, c) => n + c.roles.length, 0), []);

  return { assignments, directory, myRole, loading, reload, roleKeyToCategory, filledCount, totalRoles };
}

// The working tool — pick or invite someone into each named role slot,
// set their rate, manage department leads. What used to be Call
// Sheet's only screen before it split into this (manage) + the
// dedicated, read-only Call Sheet tab below (view/print) — production
// juggling assignments all week shouldn't share a tab with the printed
// handout you send out once the roster's locked.
export function CrewTab({ campaignId }: { campaignId: string; campaignName: string }) {
  const { crewProfile } = useAuth();
  const { assignments, directory, myRole, loading, reload, roleKeyToCategory, filledCount, totalRoles } = useCallSheetData(campaignId);
  const [pickerRole, setPickerRole] = useState<{ key: string; label: string } | null>(null);

  const myLeadCategories = useMemo(() => {
    const cats = new Set<string>();
    if (myRole === "lead" && crewProfile) {
      for (const a of assignments.values()) {
        if (a.isDepartmentLead && a.crewPayeeId === crewProfile.id) {
          const cat = roleKeyToCategory.get(a.roleKey);
          if (cat) cats.add(cat);
        }
      }
    }
    return cats;
  }, [assignments, myRole, crewProfile, roleKeyToCategory]);

  function canEditRole(roleKey: string): boolean {
    if (myRole === "admin" || myRole === "producer") return true;
    if (myRole === "lead") {
      const cat = roleKeyToCategory.get(roleKey);
      return !!cat && myLeadCategories.has(cat);
    }
    return false;
  }

  const canManageLeads = myRole === "admin" || myRole === "producer";

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading crew...</div>;

  if (myRole === null) {
    return <div className="p-6 text-sm text-muted-foreground">You don't have access to this campaign's crew.</div>;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-heading text-sm flex items-center gap-2">
            Crew
            {myRole === "viewer" && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1"><Lock size={9}/> Read only</span>}
            {myRole === "lead" && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">Department lead</span>}
          </div>
          <div className="text-xs text-muted-foreground">{filledCount} of {totalRoles} roles filled</div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-7">
        {CALL_SHEET_CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{cat.label}</div>
            <div className="grid grid-cols-4 gap-2">
              {cat.roles.map((r) => {
                const a = assignments.get(r.key);
                const editable = canEditRole(r.key);
                const isLead = !!a?.isDepartmentLead;
                return (
                  <button key={r.key} onClick={()=>editable && setPickerRole(r)} disabled={!editable}
                    className={cx(
                      "text-left rounded-md p-3 aspect-square flex flex-col justify-between transition-colors",
                      editable ? "cursor-pointer" : "cursor-default",
                      isLead ? "border-2 border-foreground bg-secondary"
                        : a ? "border border-foreground/30 bg-secondary"
                        : "border border-dashed border-border bg-secondary/30",
                      editable && !a && "hover:border-foreground/40"
                    )}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      {r.label} {isLead && <Star size={9} className="fill-current shrink-0"/>}
                    </div>
                    {a ? (
                      <div>
                        <div className="text-sm font-medium leading-snug line-clamp-2">{a.fullName}</div>
                        {a.rate != null && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">${a.rate.toLocaleString()}</div>}
                      </div>
                    ) : editable ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Plus size={11}/> Assign</div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50">—</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {pickerRole && (
        <RolePickerModal
          role={pickerRole}
          campaignId={campaignId}
          directory={directory}
          current={assignments.get(pickerRole.key) ?? null}
          canManageLeads={canManageLeads}
          onClose={()=>setPickerRole(null)}
          onAssigned={async ()=>{ setPickerRole(null); await reload(); }}
        />
      )}
    </div>
  );
}

// The printed handout — read-only, no assignment/rate/lead controls at
// all, since this is what gets handed to people on set, not a work
// surface. Anyone with call-sheet access can view and print it
// regardless of their edit permissions on Crew.
export default function CallSheet({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const { myRole, loading, filledCount, totalRoles, assignments } = useCallSheetData(campaignId);
  const [printMode, setPrintMode] = useState<"boxes" | "standard" | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => { window.print(); setPrintMode(null); }, 60);
    return () => clearTimeout(t);
  }, [printMode]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading call sheet...</div>;

  if (myRole === null) {
    return <div className="p-6 text-sm text-muted-foreground">You don't have access to this campaign's call sheet.</div>;
  }

  return (
    <div data-print-mode={printMode ?? undefined} className="call-sheet-root h-full overflow-auto">
      <div className="call-sheet-noprint px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-heading text-sm">Call Sheet</div>
          <div className="text-xs text-muted-foreground">{filledCount} of {totalRoles} roles filled</div>
        </div>
        <div className="relative">
          <Btn variant="outline" size="sm" icon={<Printer size={13}/>} onClick={()=>setPrintMenuOpen((o)=>!o)}>
            Print <ChevronDown size={12}/>
          </Btn>
          {printMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg py-1 w-52 z-20">
              <button onClick={()=>{ setPrintMenuOpen(false); setPrintMode("standard"); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary cursor-pointer">
                Standard call sheet
                <div className="text-[10px] text-muted-foreground">Plain list, role and name</div>
              </button>
              <button onClick={()=>{ setPrintMenuOpen(false); setPrintMode("boxes"); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary cursor-pointer">
                With boxes
                <div className="text-[10px] text-muted-foreground">Same layout as the Crew tab</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Print header — visible only when printing */}
      <div className="hidden print:block px-2 pt-4 pb-2">
        <div className="text-lg font-semibold">{campaignName} — Call Sheet</div>
        <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      {/* Boxes layout — same visual as Crew, but inert (no click targets) */}
      <div className={cx("call-sheet-boxes px-6 py-5 space-y-7", printMode==="standard" && "hidden")}>
        {CALL_SHEET_CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{cat.label}</div>
            <div className="grid grid-cols-4 gap-2 print:grid-cols-4">
              {cat.roles.map((r) => {
                const a = assignments.get(r.key);
                const isLead = !!a?.isDepartmentLead;
                return (
                  <div key={r.key}
                    className={cx(
                      "text-left rounded-md p-3 aspect-square flex flex-col justify-between",
                      isLead ? "border-2 border-foreground bg-secondary"
                        : a ? "border border-foreground/30 bg-secondary"
                        : "border border-dashed border-border bg-secondary/30"
                    )}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      {r.label} {isLead && <Star size={9} className="fill-current shrink-0"/>}
                    </div>
                    {a ? (
                      <div>
                        <div className="text-sm font-medium leading-snug line-clamp-2">{a.fullName}</div>
                        {a.rate != null && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">${a.rate.toLocaleString()}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/50">—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Standard layout — plain list, print-only alternate to the boxes above */}
      <div className={cx("call-sheet-standard hidden px-6 py-5", printMode==="standard" && "block")}>
        {CALL_SHEET_CATEGORIES.map((cat) => (
          <div key={cat.key} className="mb-4 break-inside-avoid">
            <div className="text-xs font-semibold uppercase tracking-wide border-b border-border pb-1 mb-1">{cat.label}</div>
            {cat.roles.map((r) => {
              const a = assignments.get(r.key);
              return (
                <div key={r.key} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium">{a?.fullName ?? "—"}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function RolePickerModal({ role, campaignId, directory, current, canManageLeads, onClose, onAssigned }: {
  role: { key: string; label: string }; campaignId: string; directory: CrewDirectoryEntry[];
  current: CallSheetAssignment | null; canManageLeads: boolean; onClose: () => void; onAssigned: () => void;
}) {
  const [mode, setMode] = useState<"pick" | "invite">("pick");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [rateInput, setRateInput] = useState(current?.rate != null ? String(current.rate) : "");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  async function saveRate() {
    setRateSaving(true);
    setError(null);
    const n = rateInput.trim() === "" ? null : Number(rateInput);
    const { error: err } = await updateCrewSlotRate(campaignId, role.key, n != null && Number.isFinite(n) ? n : null);
    setRateSaving(false);
    if (err) { setError(err); return; }
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 1500);
  }

  const filtered = directory.filter((d) => d.fullName.toLowerCase().includes(query.toLowerCase()));

  async function pick(payeeId: string) {
    setSaving(true);
    setError(null);
    const { error: err } = await assignCallSheetRole(campaignId, role.key, payeeId);
    setSaving(false);
    if (err) { setError(err); return; }
    onAssigned();
  }

  async function invite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await inviteCrewToCallSheet(campaignId, role.key, inviteName.trim(), inviteEmail.trim(), null);
    setSaving(false);
    if (err) { setError(err); return; }
    onAssigned();
  }

  async function clear() {
    setSaving(true);
    await clearCallSheetRole(campaignId, role.key);
    setSaving(false);
    onAssigned();
  }

  async function toggleLead() {
    setSaving(true);
    setError(null);
    const { error: err } = await setDepartmentLead(campaignId, role.key, !current?.isDepartmentLead);
    setSaving(false);
    if (err) { setError(err); return; }
    onAssigned();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-heading text-sm">{role.label}</div>
          {current && <div className="text-xs text-muted-foreground mt-0.5">Currently {current.fullName}</div>}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>

      {current && canManageLeads && (
        <button onClick={toggleLead} disabled={saving}
          className="w-full flex items-center gap-2 px-5 py-2.5 border-b border-border text-xs hover:bg-secondary cursor-pointer transition-colors">
          <Star size={12} className={current.isDepartmentLead ? "fill-current" : ""}/>
          {current.isDepartmentLead ? "Department lead — click to remove" : "Make department lead"}
        </button>
      )}

      {/* Rate: production-only (same population as department-lead
          management) — the RPC itself also only allows brand staff, so
          this stays hidden from a department lead rather than showing a
          control that would just error. Editable any time the campaign
          stays open, not locked at booking like the model rate flow. */}
      {current && canManageLeads && (
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Rate</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <span className="px-2.5 py-1.5 text-xs text-muted-foreground border-r border-border">$</span>
              <input value={rateInput} onChange={e=>setRateInput(e.target.value)} placeholder="0.00"
                className="flex-1 px-2.5 py-1.5 text-xs bg-transparent focus:outline-none"/>
            </div>
            <button onClick={saveRate} disabled={rateSaving}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-secondary cursor-pointer transition-colors shrink-0">
              {rateSaving ? "Saving…" : rateSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="flex border-b border-border">
        <button onClick={()=>setMode("pick")} className={cx("flex-1 text-xs py-2 cursor-pointer", mode==="pick"?"border-b-2 border-foreground font-medium":"text-muted-foreground")}>From directory</button>
        <button onClick={()=>setMode("invite")} className={cx("flex-1 text-xs py-2 cursor-pointer", mode==="invite"?"border-b-2 border-foreground font-medium":"text-muted-foreground")}>Invite new</button>
      </div>

      <div className="p-4">
        {mode==="pick" ? (
          <>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search people you've worked with..."
                className="w-full bg-input-background border border-border rounded-md pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-foreground"/>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {filtered.length===0 && <div className="text-xs text-muted-foreground py-4 text-center">No one matches yet — try inviting someone new.</div>}
              {filtered.map((d) => (
                <button key={d.id} disabled={saving} onClick={()=>pick(d.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary cursor-pointer transition-colors">
                  <div className="text-sm font-medium">{d.fullName}</div>
                  <div className="text-xs text-muted-foreground">{d.email}{d.discipline ? ` · ${d.discipline}` : ""}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <TextInput label="Full Name" value={inviteName} onChange={(e)=>setInviteName(e.target.value)} placeholder="e.g. Jordan Ives"/>
            <TextInput label="Email" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="jordan@example.com"/>
            <Btn variant="primary" fullWidth disabled={saving || !inviteName.trim() || !inviteEmail.trim()} onClick={invite}>
              {saving ? "Sending..." : "Invite & Assign"}
            </Btn>
          </div>
        )}
        {error && <div className="text-xs text-[#C0392B] mt-3">{error}</div>}
        {current && (
          <button onClick={clear} disabled={saving} className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3 cursor-pointer">
            Clear this role
          </button>
        )}
      </div>
    </Modal>
  );
}
