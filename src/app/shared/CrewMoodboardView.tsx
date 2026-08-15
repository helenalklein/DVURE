import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cx, XBox, CountryFlag } from "./ui";
import { fetchCampaignSubmissionsForCrew, type CrewSubmissionCard } from "../../lib/queries/crewMoodboard";
import type { SubmissionStage } from "./types";

const PIPELINE_STAGES: { id: SubmissionStage; label: string }[] = [
  { id: "submitted", label: "Submitted" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "selected", label: "Selected" },
  { id: "booked", label: "Booked" },
];

// Read-only view of the Model Board for crew — same underlying
// submissions data brand staff work from (via fetch_campaign_submissions_for_crew,
// a security-definer RPC scoped to my_call_sheet_role()), no drag/drop,
// stage actions, contracts, or booking — crew needs to see who's in the
// running and who's confirmed, not manage the pipeline. Declined/
// released talent stays hidden, same as the brand's own default view.
export default function CrewMoodboardView({ campaignId }: { campaignId: string }) {
  const [cards, setCards] = useState<CrewSubmissionCard[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchCampaignSubmissionsForCrew(campaignId).then(c => { if (active) setCards(c); });
    return () => { active = false; };
  }, [campaignId]);

  if (cards === null) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const byStage = (s: SubmissionStage) => cards.filter(c => c.stage === s);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PIPELINE_STAGES.map(stage => {
          const stageCards = byStage(stage.id);
          return (
            <div key={stage.id}>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{stage.label} ({stageCards.length})</div>
              <div className="space-y-2">
                {stageCards.length === 0 && <div className="text-xs text-muted-foreground italic">None yet</div>}
                {stageCards.map(c => (
                  <div key={c.modelId} className="glass-subtle rounded-md border border-border overflow-hidden">
                    <div className="relative">
                      {c.photo ? <img src={c.photo} alt="" className="w-full h-32 object-cover"/> : <XBox className="w-full h-32"/>}
                    </div>
                    <div className="p-2.5 space-y-0.5">
                      <div className="text-xs font-semibold leading-tight truncate flex items-center gap-1">
                        {c.name} <CountryFlag location={c.location} className="text-[11px] shrink-0"/>
                      </div>
                      {c.agencyName && <div className="text-[10px] text-muted-foreground truncate">{c.agencyName}</div>}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                        <span>{c.height}</span><span>·</span><span className="truncate">{c.location.split(",")[0]}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[10px] font-mono font-medium">{c.rate}</div>
                        <div className={cx("flex items-center gap-0.5", c.score===0 && "opacity-0")}>
                          {[0,1,2,3,4].map(i=><Star key={i} size={7} className={i<c.score?"fill-foreground text-foreground":"text-muted-foreground"}/>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
