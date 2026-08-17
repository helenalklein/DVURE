import { useEffect, useMemo, useState } from "react";
import { Printer, Plus, X, Search, ChevronDown, Lock, Star, Shield } from "lucide-react";
import { cx, Btn, Modal, TextInput } from "./ui";
import { CALL_SHEET_CATEGORIES, type CallSheetCategory } from "./callSheetRoles";
import { useAuth } from "./auth";
import {
  fetchCallSheetSlots, fetchCrewDirectory, fetchMyCallSheetRole, assignCallSheetRole, clearCallSheetRole,
  inviteCrewToCallSheet, setDepartmentLead, updateCrewSlotRate, setProjectAdmin,
  fetchCustomCrewRoles, addCustomCrewRole, removeCustomCrewRole,
  type CallSheetAssignment, type CrewDirectoryEntry, type CallSheetPermission, type CustomCrewRole,
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
  const [customRoles, setCustomRoles] = useState<CustomCrewRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [slots, dir, role, custom] = await Promise.all([
      fetchCallSheetSlots(campaignId), fetchCrewDirectory(), fetchMyCallSheetRole(campaignId), fetchCustomCrewRoles(campaignId),
    ]);
    setAssignments(new Map(slots.map((s) => [s.roleKey, s])));
    setDirectory(dir);
    setMyRole(role);
    setCustomRoles(custom);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [campaignId]);

  // Fixed 11 categories, each with any custom/repeated roles appended,
  // plus wholly custom departments tacked on at the end — one list the
  // rest of the UI can just iterate, same shape (key/label/roles)
  // whether a category is fixed or user-added.
  const displayCategories: CallSheetCategory[] = useMemo(() => {
    const byCategory = new Map<string, CallSheetCategory>();
    for (const cat of CALL_SHEET_CATEGORIES) byCategory.set(cat.key, { ...cat, roles: [...cat.roles] });
    for (const r of customRoles) {
      const existing = byCategory.get(r.categoryKey);
      if (existing) {
        existing.roles.push({ key: r.roleKey, label: r.roleLabel });
      } else {
        byCategory.set(r.categoryKey, { key: r.categoryKey, label: r.categoryLabel ?? r.categoryKey, roles: [{ key: r.roleKey, label: r.roleLabel }] });
      }
    }
    return [...byCategory.values()];
  }, [customRoles]);

  const roleKeyToCategory = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of displayCategories) for (const r of cat.roles) m.set(r.key, cat.key);
    return m;
  }, [displayCategories]);

  const customRoleKeys = useMemo(() => new Set(customRoles.map(r => r.roleKey)), [customRoles]);

  const filledCount = assignments.size;
  const totalRoles = useMemo(() => displayCategories.reduce((n, c) => n + c.roles.length, 0), [displayCategories]);

  return { assignments, directory, myRole, loading, reload, roleKeyToCategory, filledCount, totalRoles, displayCategories, customRoleKeys };
}

// The working tool — pick or invite someone into each named role slot,
// set their rate, manage department leads. Also the printable staffing
// roster (Print button below) — a quick "who's confirmed for what"
// handout, distinct from the real per-shoot-day Call Sheet (location,
// schedule, logistics; see RealCallSheet.tsx) which is what campaign
// workspaces now default to under "Call Sheet".
export function CrewTab({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const { crewProfile } = useAuth();
  const { assignments, directory, myRole, loading, reload, roleKeyToCategory, filledCount, totalRoles, displayCategories, customRoleKeys } = useCallSheetData(campaignId);
  const [pickerRole, setPickerRole] = useState<{ key: string; label: string } | null>(null);
  const [addRoleCategory, setAddRoleCategory] = useState<{ key: string; label: string } | null>(null);
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [printMode, setPrintMode] = useState<"boxes" | "standard" | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => { window.print(); setPrintMode(null); }, 60);
    return () => clearTimeout(t);
  }, [printMode]);

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

  // A lead only ever edits/adds within their OWN department — per
  // direct instruction, seeing who's working elsewhere is fine, but
  // managing another department's roster is not.
  function canEditRole(roleKey: string): boolean {
    if (myRole === "admin" || myRole === "producer") return true;
    if (myRole === "lead") {
      const cat = roleKeyToCategory.get(roleKey);
      return !!cat && myLeadCategories.has(cat);
    }
    return false;
  }
  function canAddToCategory(categoryKey: string): boolean {
    if (myRole === "admin" || myRole === "producer") return true;
    if (myRole === "lead") return myLeadCategories.has(categoryKey);
    return false;
  }

  const canManageLeads = myRole === "admin" || myRole === "producer";
  const canGrantProjectAdmin = myRole === "admin";
  const canAddDepartment = myRole === "admin" || myRole === "producer";

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading crew...</div>;

  if (myRole === null) {
    return <div className="p-6 text-sm text-muted-foreground">You don't have access to this project's crew.</div>;
  }

  return (
    <div data-print-mode={printMode ?? undefined} className="call-sheet-root h-full overflow-auto">
      <div className="call-sheet-noprint px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-heading text-sm flex items-center gap-2">
            Crew
            {myRole === "viewer" && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1"><Lock size={9}/> Read only</span>}
            {myRole === "lead" && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">Department lead</span>}
            {myRole === "admin" && crewProfile && <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5 flex items-center gap-1"><Shield size={9}/> Project admin</span>}
          </div>
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
                Standard roster
                <div className="text-[10px] text-muted-foreground">Plain list, role and name</div>
              </button>
              <button onClick={()=>{ setPrintMenuOpen(false); setPrintMode("boxes"); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-secondary cursor-pointer">
                With boxes
                <div className="text-[10px] text-muted-foreground">Same layout as this tab</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Print header — visible only when printing */}
      <div className="hidden print:block px-2 pt-4 pb-2">
        <div className="text-lg font-semibold">{campaignName} — Staffing Roster</div>
        <div className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
      </div>

      <div className={cx("px-6 py-5 space-y-7", printMode==="standard" && "print:hidden")}>
        {displayCategories.map((cat) => (
          <div key={cat.key}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{cat.label}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 gap-2">
              {cat.roles.map((r) => {
                const a = assignments.get(r.key);
                const editable = canEditRole(r.key);
                const isLead = !!a?.isDepartmentLead;
                const isCustom = customRoleKeys.has(r.key);
                return (
                  <div key={r.key} className="relative group/slot">
                    <button onClick={()=>editable && setPickerRole(r)} disabled={!editable || !!printMode}
                      className={cx(
                        "w-full text-left rounded-md p-3 aspect-square flex flex-col justify-between transition-colors",
                        editable ? "cursor-pointer" : "cursor-default",
                        a?.isProjectAdmin ? "border-2 border-foreground bg-secondary"
                          : isLead ? "border-2 border-foreground bg-secondary"
                          : a ? "border border-foreground/30 bg-secondary"
                          : "border border-dashed border-border bg-secondary/30",
                        editable && !a && "hover:border-foreground/40"
                      )}>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        {r.label} {a?.isProjectAdmin ? <Shield size={9} className="fill-current shrink-0"/> : isLead && <Star size={9} className="fill-current shrink-0"/>}
                      </div>
                      {a ? (
                        <div>
                          <div className="text-sm font-medium leading-snug line-clamp-2">{a.fullName}</div>
                          {a.rate != null && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">${a.rate.toLocaleString()}</div>}
                        </div>
                      ) : editable && !printMode ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Plus size={11}/> Assign</div>
                      ) : (
                        <div className="text-xs text-muted-foreground/50">—</div>
                      )}
                    </button>
                    {isCustom && editable && !printMode && (
                      <button onClick={async (e)=>{ e.stopPropagation(); await removeCustomCrewRole(campaignId, r.key); await reload(); }}
                        title="Remove this role"
                        className="call-sheet-noprint absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity hover:bg-secondary">
                        <X size={9}/>
                      </button>
                    )}
                  </div>
                );
              })}
              {canAddToCategory(cat.key) && !printMode && (
                <button onClick={()=>setAddRoleCategory({ key: cat.key, label: cat.label })}
                  className="call-sheet-noprint text-left rounded-md p-3 aspect-square flex flex-col justify-center items-center gap-1 border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground cursor-pointer transition-colors">
                  <Plus size={14}/>
                  <span className="text-[10px] font-mono uppercase tracking-wide">Other</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* "+" bar — a flat divider broken by a centered add-department
            button, per direct instruction. Admin/producer only: a new
            department is a project-structure decision, not something
            any one department lead should add unilaterally. */}
        {canAddDepartment && !printMode && (
          <div className="call-sheet-noprint relative flex items-center py-2">
            <div className="flex-1 h-px bg-border"/>
            <button onClick={()=>setAddingDepartment(true)}
              className="mx-3 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
              title="Add a department">
              <Plus size={15}/>
            </button>
            <div className="flex-1 h-px bg-border"/>
          </div>
        )}
      </div>

      {/* Standard layout — plain list, print-only alternate to the boxes above */}
      <div className={cx("hidden px-6 py-5", printMode==="standard" && "print:block")}>
        {displayCategories.map((cat) => (
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

      {pickerRole && (
        <RolePickerModal
          role={pickerRole}
          campaignId={campaignId}
          directory={directory}
          current={assignments.get(pickerRole.key) ?? null}
          canManageLeads={canManageLeads}
          canGrantProjectAdmin={canGrantProjectAdmin}
          onClose={()=>setPickerRole(null)}
          onAssigned={async ()=>{ setPickerRole(null); await reload(); }}
        />
      )}

      {addRoleCategory && (
        <AddCustomRoleModal
          campaignId={campaignId}
          categoryKey={addRoleCategory.key}
          categoryLabel={addRoleCategory.label}
          onClose={()=>setAddRoleCategory(null)}
          onAdded={async ()=>{ setAddRoleCategory(null); await reload(); }}
        />
      )}

      {addingDepartment && (
        <AddCustomDepartmentModal
          campaignId={campaignId}
          onClose={()=>setAddingDepartment(false)}
          onAdded={async ()=>{ setAddingDepartment(false); await reload(); }}
        />
      )}
    </div>
  );
}

// "Say a photographer wants two photography assistants, they can add
// that" — also doubles as "add a genuinely custom role" (any label),
// since a repeated fixed role and a brand-new one under an existing
// department are the same operation server-side.
function AddCustomRoleModal({ campaignId, categoryKey, categoryLabel, onClose, onAdded }: {
  campaignId: string; categoryKey: string; categoryLabel: string; onClose: () => void; onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await addCustomCrewRole({ campaignId, roleLabel: label.trim(), categoryKey });
    setSaving(false);
    if (err) { setError(err); return; }
    onAdded();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">Add a role — {categoryLabel}</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-3">
        <TextInput label="Role name" placeholder="e.g. Photo Assistant, Prosthetics Artist" value={label} onChange={e=>setLabel(e.target.value)}/>
        {error && <div className="text-xs text-[#C0392B]">{error}</div>}
        <Btn variant="primary" fullWidth disabled={saving || !label.trim()} onClick={submit}>{saving ? "Adding…" : "Add role"}</Btn>
      </div>
    </Modal>
  );
}

// The "+" bar's own modal — a brand-new department, named on the spot,
// with its first role. Nothing stops adding more roles to it afterward
// via that department's own "Other" button once it exists.
function AddCustomDepartmentModal({ campaignId, onClose, onAdded }: {
  campaignId: string; onClose: () => void; onAdded: () => void;
}) {
  const [deptLabel, setDeptLabel] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!deptLabel.trim() || !roleLabel.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await addCustomCrewRole({ campaignId, roleLabel: roleLabel.trim(), newCategoryLabel: deptLabel.trim() });
    setSaving(false);
    if (err) { setError(err); return; }
    onAdded();
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="text-heading text-sm">Add a department</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-3">
        <TextInput label="Department name" placeholder="e.g. Special Effects, Florals" value={deptLabel} onChange={e=>setDeptLabel(e.target.value)}/>
        <TextInput label="First role in this department" placeholder="e.g. Special Effects Supervisor" value={roleLabel} onChange={e=>setRoleLabel(e.target.value)}/>
        {error && <div className="text-xs text-[#C0392B]">{error}</div>}
        <Btn variant="primary" fullWidth disabled={saving || !deptLabel.trim() || !roleLabel.trim()} onClick={submit}>{saving ? "Adding…" : "Add department"}</Btn>
      </div>
    </Modal>
  );
}

function RolePickerModal({ role, campaignId, directory, current, canManageLeads, canGrantProjectAdmin, onClose, onAssigned }: {
  role: { key: string; label: string }; campaignId: string; directory: CrewDirectoryEntry[];
  current: CallSheetAssignment | null; canManageLeads: boolean; canGrantProjectAdmin: boolean; onClose: () => void; onAssigned: () => void;
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

  async function toggleProjectAdmin() {
    setSaving(true);
    setError(null);
    const { error: err } = await setProjectAdmin(campaignId, role.key, !current?.isProjectAdmin);
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

      {current && canGrantProjectAdmin && (
        <button onClick={toggleProjectAdmin} disabled={saving}
          className="w-full flex items-start gap-2 px-5 py-2.5 border-b border-border text-xs hover:bg-secondary cursor-pointer transition-colors text-left">
          <Shield size={12} className={cx("mt-0.5 shrink-0", current.isProjectAdmin ? "fill-current" : "")}/>
          <div>
            <div>{current.isProjectAdmin ? "Project admin — click to remove" : "Grant project admin"}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Full admin-tier access to this project only — not the brand's account.</div>
          </div>
        </button>
      )}

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
