import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Camera, Clock, LogOut, DollarSign, User, Check, AlertCircle } from "lucide-react";
import { DvureSignature, Btn, TextInput, FSelect, FieldLabel, Badge, cx } from "../shared/ui";
import { useAuth } from "../shared/auth";
import {
  redeemCrewAccess, fetchMyCrewGrants, updateCrewPayee, updateMyProfile,
  type CrewAccessDetails,
} from "../../lib/queries/crewAccess";
import { fetchPendingConfirmationsForCrew } from "../../lib/queries/payments";
import PaymentConfirmQueue from "../shared/PaymentConfirmQueue";

const CREW_DISCIPLINES: { key: string; label: string }[] = [
  { key: "photographer", label: "Photographer" },
  { key: "director", label: "Director" },
  { key: "stylist", label: "Stylist" },
  { key: "hair", label: "Hair" },
  { key: "makeup_artist", label: "Makeup Artist" },
  { key: "set_designer", label: "Set Designer" },
  { key: "retoucher", label: "Retoucher" },
  { key: "casting_director", label: "Casting Director" },
  { key: "location_scout", label: "Location Scout" },
  { key: "gaffer", label: "Gaffer" },
  { key: "digital_tech", label: "Digital Tech" },
  { key: "assistant", label: "Assistant" },
  { key: "other", label: "Other" },
];

function disciplineLabel(key: string | null) {
  if (!key) return null;
  return CREW_DISCIPLINES.find((d) => d.key === key)?.label ?? key.replace("_", " ");
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CampaignCard({ g, live }: { g: CrewAccessDetails; live: boolean }) {
  return (
    <div className="glass-subtle border rounded-lg p-5 mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-muted-foreground shrink-0"/>
          <div className="text-sm font-semibold">{g.campaignName}</div>
        </div>
        {live
          ? <span className="text-[10px] font-mono uppercase tracking-widest bg-foreground text-primary-foreground px-2 py-0.5 rounded-full shrink-0">Live</span>
          : <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5 rounded-full shrink-0">Past</span>}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>{g.brandName}</div>
        {fmtDate(g.dueDate) && <div>Due {fmtDate(g.dueDate)}</div>}
        <div className="capitalize">Status: {g.campaignStatus}</div>
      </div>
    </div>
  );
}

// Real, DB-derived — not tracked-yet fields dressed up as data. Every
// job the crew member has been granted access to shows here so the
// page isn't empty, but the payment column is an honest placeholder
// until crew rates/payouts are actually wired up (no schema for it
// yet — bookings today is model-only, see 0001's own table shape).
function PaymentsTab({ grants }: { grants: CrewAccessDetails[] | null }) {
  if (grants === null) return <div className="text-sm text-muted-foreground">Loading...</div>;

  // A crew member can hold a distinct crew_payees row per campaign
  // (one per booking relationship, not one global identity) — merge
  // the pending queue across every payee id from their grants rather
  // than assuming a single one.
  const payeeIds = [...new Set(grants.map(g => g.payeeId).filter((id): id is string => id != null))];

  async function fetchPending() {
    const results = await Promise.all(payeeIds.map(id => fetchPendingConfirmationsForCrew(id)));
    return results.flat();
  }

  return (
    <div>
      {payeeIds.length > 0 && <div className="mb-6"><PaymentConfirmQueue fetchPending={fetchPending}/></div>}
      <div className="bg-secondary border border-border rounded-md px-4 py-3 text-xs text-muted-foreground mb-6 flex items-start gap-2">
        <AlertCircle size={13} className="shrink-0 mt-0.5"/>
        <div>Full payout history for crew isn't wired up yet — once it's built, your rate and payout status for each job will show here. Any payment already recorded for you will show above, awaiting your confirmation.</div>
      </div>

      {grants.length === 0 ? (
        <div className="text-sm text-muted-foreground">No jobs to show payment status for yet.</div>
      ) : (
        <div className="glass-subtle border rounded-md overflow-hidden">
          {grants.map((g, i) => (
            <div key={g.grantId} className={cx("px-4 py-3 flex items-center justify-between gap-3", i>0 && "border-t border-border")}>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{g.campaignName}</div>
                <div className="text-xs text-muted-foreground">{g.brandName}</div>
              </div>
              <Badge label="Not tracked yet" variant="default"/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Real edits, not a UI shell — saves land in crew_payees (identity
// brands see on a call sheet) and profiles (the account record) via
// their own self-update RLS policies (0028/0002), then refreshIdentity()
// pulls the change back through context so the header updates too.
function ProfileTab() {
  const { profile, crewProfile, refreshIdentity } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [discipline, setDiscipline] = useState(crewProfile?.discipline ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFullName(profile?.fullName ?? ""); setPhone(profile?.phone ?? ""); }, [profile]);
  useEffect(() => { setDiscipline(crewProfile?.discipline ?? ""); }, [crewProfile]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const [r1, r2] = await Promise.all([
      profile ? updateMyProfile(profile.id, { fullName, phone }) : Promise.resolve({ error: null }),
      crewProfile ? updateCrewPayee(crewProfile.id, { fullName, discipline: discipline || null }) : Promise.resolve({ error: null }),
    ]);
    setSaving(false);
    const err = r1.error ?? r2.error;
    if (err) { setError(err); return; }
    await refreshIdentity();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const dirty = fullName !== (profile?.fullName ?? "") || phone !== (profile?.phone ?? "") || discipline !== (crewProfile?.discipline ?? "");

  return (
    <div className="space-y-4 max-w-sm">
      <TextInput label="Full Name" placeholder="Your name" value={fullName} onChange={(e)=>setFullName(e.target.value)}/>
      <div>
        <FieldLabel>Email</FieldLabel>
        <div className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm text-muted-foreground">{profile?.email}</div>
      </div>
      <TextInput label="Phone" type="tel" placeholder="+1 000 000 0000" value={phone} onChange={(e)=>setPhone(e.target.value)}/>
      <FSelect label="Discipline" options={CREW_DISCIPLINES.map(d=>d.label)}
        value={disciplineLabel(discipline) ?? ""}
        onChange={(label)=>setDiscipline(CREW_DISCIPLINES.find(d=>d.label===label)?.key ?? "")}/>

      {error && <div className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</div>}

      <div className="flex items-center gap-3 pt-1">
        <Btn variant="primary" onClick={save} disabled={saving || !dirty}>{saving ? "Saving..." : "Save Changes"}</Btn>
        {saved && <span className="text-xs text-[#27AE60] flex items-center gap-1"><Check size={12}/> Saved</span>}
      </div>
    </div>
  );
}

type CrewTab = "current" | "history" | "payments" | "profile";
const CREW_TABS: { id: CrewTab; label: string }[] = [
  { id: "current", label: "Current" },
  { id: "history", label: "History" },
  { id: "payments", label: "Payments" },
  { id: "profile", label: "Profile" },
];

// Signed-in dashboard — every grant this crew member has ever been
// issued, current and past alike. No "browse upcoming campaigns" the
// way a model gets through their agency: a grant is still the only way
// in, live or historical (see 0024's own comment on why).
function CrewDashboard({ onLogout }: { onLogout?: () => void }) {
  const { crewProfile } = useAuth();
  const [grants, setGrants] = useState<CrewAccessDetails[] | null>(null);
  const [tab, setTab] = useState<CrewTab>("current");

  useEffect(() => {
    let active = true;
    fetchMyCrewGrants().then((g) => { if (active) setGrants(g); });
    return () => { active = false; };
  }, []);

  const now = Date.now();
  const current = (grants ?? []).filter((g) => new Date(g.expiresAt).getTime() > now);
  const past = (grants ?? []).filter((g) => new Date(g.expiresAt).getTime() <= now);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <DvureSignature size={16}/>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">{crewProfile?.fullName ?? "Crew"}</div>
            {crewProfile?.discipline && <div className="text-[11px] text-muted-foreground">{disciplineLabel(crewProfile.discipline)}</div>}
          </div>
          {onLogout && (
            <button onClick={onLogout} className="text-muted-foreground hover:text-foreground cursor-pointer" title="Sign out">
              <LogOut size={15}/>
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-border px-6">
        <div className="max-w-lg mx-auto flex items-center gap-1">
          {CREW_TABS.map((t) => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={cx("px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5",
                tab===t.id ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              {t.id==="payments" && <DollarSign size={13}/>}
              {t.id==="profile" && <User size={13}/>}
              {t.id==="history" && <Clock size={13}/>}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        {tab === "current" && (
          <>
            {grants === null && <div className="text-sm text-muted-foreground">Loading...</div>}
            {grants !== null && current.length === 0 && (
              <div className="text-sm text-muted-foreground">No live campaigns right now. You'll see them here as soon as a production sends you access.</div>
            )}
            {current.map((g) => <CampaignCard key={g.grantId} g={g} live/>)}
          </>
        )}

        {tab === "history" && (
          <>
            {grants === null && <div className="text-sm text-muted-foreground">Loading...</div>}
            {grants !== null && past.length === 0 && (
              <div className="text-sm text-muted-foreground">No completed jobs yet — they'll move here once their access window ends.</div>
            )}
            {past.map((g) => <CampaignCard key={g.grantId} g={g} live={false}/>)}
          </>
        )}

        {tab === "payments" && <PaymentsTab grants={grants}/>}

        {tab === "profile" && <ProfileTab/>}
      </div>
    </div>
  );
}

// Emergency / day-of direct link — works even without a session, for
// when signing in isn't an option. Redundant with the dashboard above
// once a crew member actually has a login, not the only way in anymore.
function EmergencyAccessView({ accessCode }: { accessCode: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<CrewAccessDetails | null>(null);

  useEffect(() => {
    let active = true;
    redeemCrewAccess(accessCode).then(({ data, error: err }) => {
      if (!active) return;
      if (err || !data) { setState("error"); setError(err ?? "This access link isn't valid."); return; }
      setDetails(data);
      setState("ready");
    });
    return () => { active = false; };
  }, [accessCode]);

  if (state === "loading") {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Checking your access...</div>;
  }

  if (state === "error" || !details) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <DvureSignature size={20}/>
        <div className="max-w-sm text-center">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
            <Lock size={16} className="text-muted-foreground"/>
          </div>
          <div className="text-sm font-semibold mb-1">This link isn't working</div>
          <div className="text-xs text-muted-foreground">{error}</div>
          <div className="text-xs text-muted-foreground mt-3">Ask whoever sent you this link for a new one.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <DvureSignature size={16}/>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Emergency Access</div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Welcome</div>
          <div className="text-heading text-xl">{details.payeeName}</div>
        </div>
        <CampaignCard g={details} live/>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
          <Clock size={11}/> This link works until {fmtDate(details.expiresAt.slice(0,10))}.
        </div>
      </div>
    </div>
  );
}

export default function CrewApp({ onLogout }: { onLogout?: () => void }) {
  const { accessCode } = useParams<{ accessCode?: string }>();
  if (accessCode) return <EmergencyAccessView accessCode={accessCode}/>;
  return <CrewDashboard onLogout={onLogout}/>;
}
