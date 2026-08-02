import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Camera, Clock } from "lucide-react";
import { DvureSignature } from "../shared/ui";
import { redeemCrewAccess, type CrewAccessDetails } from "../../lib/queries/crewAccess";

// Crew/artists never get a real Supabase Auth account — this whole view
// is reached via one link containing the access code, no sign-in step.
// Every visit re-verifies the code fresh against redeem_crew_access()
// (expired/revoked codes fail here, not client-side), so there's no
// session to go stale — the code itself IS the session. Deliberately
// much lighter than ModelApp: one campaign, no roster history, no
// multi-campaign profile, matching the ephemeral nature of the access
// grant itself (see 0011/0012's own design notes).
export default function CrewApp() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<CrewAccessDetails | null>(null);

  useEffect(() => {
    if (!accessCode) { setState("error"); setError("No access code provided."); return; }
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Checking your access...</div>
      </div>
    );
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

  const expiresLabel = new Date(details.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dueLabel = details.dueDate ? new Date(details.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <DvureSignature size={16}/>
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Crew Access</div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">Welcome</div>
          <div className="text-heading text-xl mb-1">{details.payeeName}</div>
          {details.payeeDiscipline && (
            <div className="text-xs text-muted-foreground capitalize">{details.payeeDiscipline.replace("_", " ")}</div>
          )}
        </div>

        <div className="glass-subtle border rounded-lg p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={14} className="text-muted-foreground"/>
            <div className="text-sm font-semibold">{details.campaignName}</div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>{details.brandName}</div>
            {dueLabel && <div>Due {dueLabel}</div>}
            <div className="capitalize">Status: {details.campaignStatus}</div>
          </div>
        </div>

        <div className="glass-subtle border rounded-lg p-5 mb-4">
          <div className="text-sm font-semibold mb-2">Payment</div>
          <div className="text-xs text-muted-foreground">
            Payment tracking for crew and production staff isn't wired up yet — this is where your rate and payout status for this campaign will show once that's built.
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock size={11}/> This access link works until {expiresLabel}.
        </div>
      </div>
    </div>
  );
}
