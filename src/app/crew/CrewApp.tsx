import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Camera, Clock, LogOut } from "lucide-react";
import { DvureSignature } from "../shared/ui";
import { useAuth } from "../shared/auth";
import { redeemCrewAccess, fetchMyCrewGrants, type CrewAccessDetails } from "../../lib/queries/crewAccess";

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
      <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
        <div>{g.brandName}</div>
        {fmtDate(g.dueDate) && <div>Due {fmtDate(g.dueDate)}</div>}
        <div className="capitalize">Status: {g.campaignStatus}</div>
      </div>
      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold mb-1">Payment</div>
        <div className="text-xs text-muted-foreground">
          {live
            ? "Payment tracking for crew isn't wired up yet — this is where your rate and payout status will show once that's built."
            : "Payment record for this completed job will show here once crew payment tracking is built."}
        </div>
      </div>
    </div>
  );
}

// Signed-in dashboard — every grant this crew member has ever been
// issued, current and past alike. No "browse upcoming campaigns" the
// way a model gets through their agency: a grant is still the only way
// in, live or historical (see 0024's own comment on why).
function CrewDashboard({ onLogout }: { onLogout?: () => void }) {
  const { crewProfile } = useAuth();
  const [grants, setGrants] = useState<CrewAccessDetails[] | null>(null);

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
            {crewProfile?.discipline && <div className="text-[11px] text-muted-foreground capitalize">{crewProfile.discipline.replace("_", " ")}</div>}
          </div>
          {onLogout && (
            <button onClick={onLogout} className="text-muted-foreground hover:text-foreground cursor-pointer" title="Sign out">
              <LogOut size={15}/>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        {grants === null && <div className="text-sm text-muted-foreground">Loading...</div>}

        {grants !== null && grants.length === 0 && (
          <div className="text-sm text-muted-foreground">No campaigns have been shared with you yet. You'll see them here as soon as a production sends you access.</div>
        )}

        {current.length > 0 && (
          <div className="mb-8">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">Current</div>
            {current.map((g) => <CampaignCard key={g.grantId} g={g} live/>)}
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">Past</div>
            {past.map((g) => <CampaignCard key={g.grantId} g={g} live={false}/>)}
          </div>
        )}
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
