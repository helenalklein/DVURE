import { useState, useMemo, useEffect } from "react";
import { LogOut, Plus, Send, MessageSquare, Inbox, Users2, CreditCard, X, UserPlus, Search, ChevronRight } from "lucide-react";
import { cx, XBox, Badge, Btn, Stat, TopBar, TextInput, FSelect, Textarea, FieldLabel, Modal, CurrentUserProvider, useCurrentUser, CountryFlag } from "../shared/ui";
import { BOOKINGS, bookingBreakdown, MOCK_NOW, CAMPAIGNS, CAMPAIGN_AGENCY_THREADS, ORG_COUNTRY } from "../shared/mockData";
import type { RosterModel, CampaignThreadMessage } from "../shared/types";
import { useAuth } from "../shared/auth";
import { fetchAgencyRoster, insertRosterModel } from "../../lib/queries/roster";
import { findCampaignIdByName } from "../../lib/queries/campaigns";
import { insertSubmission } from "../../lib/queries/submissions";

type View = "invitations" | "submit" | "roster" | "payments" | "messaging";

const NAV: { id: View; label: string; Icon: typeof Inbox; count?: number }[] = [
  { id:"invitations", label:"Campaign Invitations", Icon:Inbox,         count:3 },
  { id:"submit",       label:"Talent Submissions",   Icon:Send                  },
  { id:"roster",       label:"Talent Roster",        Icon:Users2                },
  { id:"payments",     label:"Payments",             Icon:CreditCard            },
  { id:"messaging",    label:"Messaging",            Icon:MessageSquare, count:1 },
];

const INVITATIONS = [
  { brand:"Acne Studios", campaign:"AW25 Womenswear Campaign", type:"Editorial", due:"06/20/2025", budget:"$800–$1,200/day", models:3, submissionOpen:"May 1, 2026", submissionClose:"Aug 15, 2026" },
  { brand:"Nike",         campaign:"Run Global SS25",          type:"Fitness",   due:"07/01/2025", budget:"$600–$900/day",   models:5, submissionOpen:"Jul 1, 2026", submissionClose:"Aug 5, 2026"  },
  { brand:"Chanel",       campaign:"Beauty Editorial AW25",    type:"Beauty",    due:"06/28/2025", budget:"$1,200–$2,000/day", models:2, submissionOpen:"Jul 10, 2026", submissionClose:"Jul 24, 2026" },
];

function submissionIsClosed(inv: { submissionClose: string }) {
  return MOCK_NOW > new Date(inv.submissionClose);
}

function InvitationsView({ onSubmitTalent }: { onSubmitTalent: (campaign: string) => void }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground mb-4">Brand campaign invitations requiring talent submissions.</p>
      {INVITATIONS.map(inv=>{
        const closed = submissionIsClosed(inv);
        return (
          <div key={inv.campaign} className="glass-subtle border rounded-md p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-sm font-semibold">{inv.campaign}</div>
                <div className="text-xs text-muted-foreground">{inv.brand} · {inv.type} · Due {inv.due}</div>
              </div>
              <Badge label={`${inv.models} needed`} variant="info"/>
            </div>
            <div className="text-xs text-muted-foreground mb-1">Budget: {inv.budget}</div>
            <div className="text-[10px] font-mono text-muted-foreground mb-3 flex items-center gap-1.5">
              <span>Submissions {inv.submissionOpen} – {inv.submissionClose}</span>
              {closed
                ? <span className="text-urgent font-semibold">Closed</span>
                : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" size="sm" disabled={closed} onClick={()=>onSubmitTalent(inv.campaign)}>
                {closed ? "Submission Closed" : "Submit Talent"}
              </Btn>
              <Btn variant="outline" size="sm">View Brief</Btn>
              <Btn variant="ghost" size="sm">Decline</Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Visual, alphabetically-indexed model picker — a card board, not a
// dropdown. This industry casts off photos and physical presence, not
// text lists, so selection should feel like flipping through a board.
function RosterPickerModal({ roster, campaign, statusFor, onPick, onClose }: {
  roster: RosterModel[]; campaign: string; statusFor: (modelId: string, campaign: string) => CampaignSubmissionStatus | undefined;
  onPick: (id: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const filtered = roster
      .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => a.name.localeCompare(b.name));
    const byLetter = new Map<string, RosterModel[]>();
    for (const m of filtered) {
      const letter = m.name.trim()[0]?.toUpperCase() ?? "#";
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter)!.push(m);
    }
    return [...byLetter.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [roster, search]);

  const letters = groups.map(([l]) => l);

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <div className="text-sm font-semibold">Choose a Model</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">From your roster, A–Z</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="flex-1 flex items-center border border-border rounded-md bg-input-background px-3 gap-2 h-9">
          <Search size={13} className="text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roster…"
            className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
        </div>
        {letters.length>0 && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground shrink-0">
            {letters.map(l=><span key={l} className="w-4 text-center">{l}</span>)}
          </div>
        )}
      </div>
      <div className="max-h-[26rem] overflow-y-auto px-6 py-4 space-y-6">
        {groups.length===0 && <div className="text-center text-sm text-muted-foreground py-10">No models match "{search}"</div>}
        {groups.map(([letter, models]) => (
          <div key={letter}>
            <div className="text-xs font-display italic text-muted-foreground mb-2 sticky -top-4 bg-transparent">{letter}</div>
            <div className="grid grid-cols-3 gap-3">
              {models.map(m=>{
                const status = statusFor(m.id, campaign);
                const blocked = !!status;
                return (
                  <button key={m.id} onClick={()=>{ if (!blocked) onPick(m.id); }} disabled={blocked}
                    className={cx("text-left glass-subtle border rounded-md overflow-hidden transition-all group relative",
                      blocked ? "opacity-50 cursor-not-allowed" : "hover:border-foreground hover:shadow-md"
                    )}>
                    <XBox className="w-full h-24"/>
                    {status && (
                      <div className={cx("absolute top-1.5 right-1.5 text-[8px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-sm font-semibold",
                        status.status==="declined" ? "bg-urgent text-urgent-foreground" : "bg-offwhite text-offwhite-foreground"
                      )}>
                        {status.status==="declined" ? "Declined" : "Submitted"}
                      </div>
                    )}
                    <div className="p-2.5 space-y-0.5">
                      <div className="text-xs font-semibold truncate flex items-center gap-1">{m.name} <CountryFlag location={m.location} className="text-[11px] shrink-0"/></div>
                      <div className="text-[10px] text-muted-foreground truncate">{m.location}</div>
                      <div className="text-[10px] font-mono font-medium mt-1">{m.rate}</div>
                      {status && (
                        <div className="text-[9px] text-muted-foreground pt-0.5">
                          {status.status==="declined" ? "Already declined for this campaign" : "Already submitted, awaiting review"}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// A model already submitted (pending or declined) for a given campaign
// can't be submitted again for that same campaign — regardless of which
// agency does the resubmitting, a decline is final. modelId/campaign
// pairs are unique to a specific campaign, so the same model can still
// be freely submitted to a *different* open campaign.
//
// This is only ever populated from THIS session's own successful
// submits (see handleSubmit below) — it can't pre-block a model another
// agency already submitted, since RLS hides that agency's submission row
// entirely. The real "one submission wins" rule is enforced by the
// database's unique(campaign_id, model_id) constraint: a genuinely
// blocked submit is only discovered by attempting it and getting
// rejected, surfaced below as submitError rather than a pre-check.
type CampaignSubmissionStatus = { modelId: string; campaign: string; status: "pending" | "declined" };

function SubmitTalentView({ roster, onGoToRoster, initialCampaign }: { roster: RosterModel[]; onGoToRoster: () => void; initialCampaign?: string }) {
  const { profile, org } = useAuth();
  const [submitted, setSubmitted] = useState<CampaignSubmissionStatus[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pickedCampaign, setPickedCampaign] = useState(initialCampaign ?? INVITATIONS[0]?.campaign ?? "");
  const [pickedModelId, setPickedModelId] = useState<string | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function statusFor(modelId: string, campaign: string) {
    return submitted.find(s => s.modelId === modelId && s.campaign === campaign);
  }

  const submittedIds = new Set(submitted.filter(s=>s.status==="pending").map(s=>s.modelId));
  const pickedModel = roster.find(m=>m.id===pickedModelId);
  const pickedInvitation = INVITATIONS.find(i=>i.campaign===pickedCampaign);
  const submissionClosed = pickedInvitation ? submissionIsClosed(pickedInvitation) : false;
  const pickedStatus = pickedModel ? statusFor(pickedModel.id, pickedCampaign) : undefined;

  function selectModel(id: string) {
    setPickedModelId(id);
    setPickedCampaign(initialCampaign ?? INVITATIONS[0]?.campaign ?? "");
    setSubmitError(null);
    setShowPicker(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!pickedModel || !org || !profile) return;
    setSubmitting(true);
    setSubmitError(null);
    const realCampaignId = await findCampaignIdByName(pickedCampaign);
    if (!realCampaignId) {
      setSubmitting(false);
      setSubmitError("This campaign isn't connected yet — check back once it's set up.");
      return;
    }
    const { error } = await insertSubmission({
      campaignId: realCampaignId,
      modelId: pickedModel.id,
      submittingAgencyId: org.id,
      submittedByProfileId: profile.id,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(
        error.code === "23505"
          ? `${pickedModel.name} has already been submitted to this campaign.`
          : "Couldn't submit this model — try again."
      );
      return;
    }
    setSubmitted(p => [...p, { modelId: pickedModel.id, campaign: pickedCampaign, status: "pending" }]);
    setShowForm(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Submit models from your roster to open campaigns.</p>
        <Btn variant="primary" size="sm" icon={<Plus size={12}/>} onClick={()=>setShowPicker(true)} disabled={roster.length===0}>Submit Talent</Btn>
      </div>

      {roster.length===0 && (
        <div className="border border-dashed border-border rounded-md p-8 text-center space-y-3">
          <div className="text-sm text-muted-foreground">Your roster is empty — add a model before you can submit talent to a campaign.</div>
          <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={onGoToRoster}>Add Model</Btn>
        </div>
      )}

      <div className="space-y-2">
        {roster.filter(m=>submittedIds.has(m.id)).map(m=>{
          const sub = submitted.find(s=>s.modelId===m.id)!;
          return (
            <div key={m.id} className="glass-subtle border border-dashed rounded-md p-4 flex items-center gap-4 opacity-70">
              <XBox className="w-12 h-12 rounded-md shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-muted-foreground">{sub.campaign} · awaiting brand review</div>
              </div>
              <Badge label="Submitted" variant="pending"/>
            </div>
          );
        })}
        {roster.filter(m=>!submittedIds.has(m.id)).map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.rate}</div>
            </div>
            <Btn variant="outline" size="sm" onClick={()=>selectModel(m.id)}>Submit</Btn>
          </div>
        ))}
      </div>

      {showPicker && (
        <RosterPickerModal roster={roster} campaign={pickedCampaign} statusFor={statusFor} onPick={selectModel} onClose={()=>setShowPicker(false)}/>
      )}

      {showForm && pickedModel && (
        <Modal onClose={()=>setShowForm(false)}>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">Submit Talent</div>
            <button onClick={()=>setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <FieldLabel>Model</FieldLabel>
              <button onClick={()=>{ setShowForm(false); setShowPicker(true); }}
                className="w-full flex items-center gap-3 border border-border rounded-md p-2.5 hover:border-foreground transition-colors text-left">
                <XBox className="w-10 h-10 rounded-sm shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{pickedModel.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{pickedModel.location} · {pickedModel.rate}</div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 shrink-0">Change <ChevronRight size={11}/></span>
              </button>
              <div className="text-[10px] text-muted-foreground font-mono mt-1">Pulled from their DVURE profile.</div>
            </div>
            <FSelect label="Campaign" options={INVITATIONS.map(i=>i.campaign)} value={pickedCampaign} onChange={setPickedCampaign}/>
            {pickedInvitation && (
              <div className={cx("text-[10px] font-mono flex items-center gap-1.5", submissionClosed ? "text-urgent" : "text-muted-foreground")}>
                <span>Submissions {pickedInvitation.submissionOpen} – {pickedInvitation.submissionClose}</span>
                {submissionClosed
                  ? <span className="font-semibold">Closed</span>
                  : <span className="text-offwhite-foreground bg-offwhite px-1 rounded-sm font-semibold">Open</span>}
              </div>
            )}
            {submissionClosed && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">
                This campaign's submission window closed {pickedInvitation!.submissionClose}. Talent can no longer be submitted.
              </div>
            )}
            {pickedStatus && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">
                {pickedStatus.status==="declined"
                  ? `${pickedModel.name} was already declined for this campaign and can't be resubmitted.`
                  : `${pickedModel.name} is already submitted to this campaign, awaiting brand review.`}
              </div>
            )}
            {submitError && (
              <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{submitError}</div>
            )}
            <Textarea label="Note to brand" placeholder="Optional — why this model fits the brief…" rows={3}/>
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <Btn variant="primary" disabled={submissionClosed || !!pickedStatus || submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit"}
            </Btn>
            <Btn variant="outline" onClick={()=>setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddModelModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Omit<RosterModel,"id"|"agency">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");

  return (
    <Modal onClose={onClose}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold">Add Model to Roster</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14}/></button>
      </div>
      <div className="p-5 space-y-3">
        <TextInput label="Full Name" placeholder="e.g. Nadia Petrov" value={name} onChange={e=>setName(e.target.value)}/>
        <TextInput label="Email" placeholder="model@example.com" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <TextInput label="Location" placeholder="e.g. New York, NY" value={location} onChange={e=>setLocation(e.target.value)}/>
        <TextInput label="Day Rate" placeholder="e.g. $1,000/day" value={rate} onChange={e=>setRate(e.target.value)}/>
        <div className="bg-secondary border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
          An invitation email will be sent to this model to set up their DVURE login, so they can see their own bookings and payment status.
        </div>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <Btn variant="primary" disabled={!name || !email} onClick={()=>{
          onAdd({ name, email, location: location||"—", rate: rate||"—", height:"—", exp:"—" });
          onClose();
        }}>Send Invitation</Btn>
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

function RosterView({ roster, onAddModel }: { roster: RosterModel[]; onAddModel: (m: Omit<RosterModel,"id"|"agency">) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Your full talent roster — it's the agency's responsibility to add models here.</p>
        <Btn variant="primary" size="sm" icon={<UserPlus size={12}/>} onClick={()=>setShowAdd(true)}>Add Model</Btn>
      </div>
      <div className="space-y-2">
        {roster.map(m=>(
          <div key={m.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
            <XBox className="w-12 h-12 rounded-md shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">{m.name} <CountryFlag location={m.location} className="text-xs"/></div>
              <div className="text-xs text-muted-foreground">{m.location} · {m.email}</div>
            </div>
            <div className="text-xs font-mono">{m.rate}</div>
          </div>
        ))}
        {roster.length===0 && (
          <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">No models yet — add your first one.</div>
        )}
      </div>
      {showAdd && <AddModelModal onClose={()=>setShowAdd(false)} onAdd={onAddModel}/>}
    </div>
  );
}

// The same private, per-campaign, per-agency thread the brand sees on
// their side (Collaboration tab) — an agency only ever sees its OWN
// thread with a brand, never another agency's. There is no way to
// message a model directly from here; models only get read-only access
// to this same thread elsewhere.
function AgencyMessagingView() {
  const currentUser = useCurrentUser();
  const meName = currentUser?.name ?? "";
  const agencyName = currentUser?.org ?? "";

  const campaignsWithThreads = INVITATIONS
    .map(inv => ({ inv, campaign: CAMPAIGNS.find(c=>c.name===inv.campaign) }))
    .filter(x => x.campaign);

  const [selected, setSelected] = useState(campaignsWithThreads[0]?.campaign?.id ?? null);
  const [threads, setThreads] = useState<Record<number, CampaignThreadMessage[]>>(() => {
    const init: Record<number, CampaignThreadMessage[]> = {};
    for (const { campaign } of campaignsWithThreads) {
      if (campaign) init[campaign.id] = CAMPAIGN_AGENCY_THREADS[campaign.id]?.[agencyName] ?? [];
    }
    return init;
  });
  const [input, setInput] = useState("");

  const selectedCampaign = campaignsWithThreads.find(x=>x.campaign?.id===selected)?.campaign;
  const msgs = selected!=null ? (threads[selected] ?? []) : [];

  function send() {
    if (!input.trim() || selected==null) return;
    setThreads(p=>({ ...p, [selected]: [...(p[selected]??[]), { id:Date.now(), from:meName, fromOrg:agencyName, text:input, ts:"Now" }] }));
    setInput("");
  }

  if (campaignsWithThreads.length===0) {
    return <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-md text-sm text-muted-foreground">No campaign threads yet.</div>;
  }

  return (
    <div className="flex-1 flex min-h-0 -m-6">
      <div className="w-56 shrink-0 border-r border-border overflow-y-auto">
        <div className="px-4 py-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border">Your Campaign Threads</div>
        {campaignsWithThreads.map(({ inv, campaign }) => (
          <button key={campaign!.id} onClick={()=>setSelected(campaign!.id)}
            className={cx("w-full text-left px-4 py-3 text-xs border-b border-border transition-colors",
              selected===campaign!.id ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}>
            <div className="truncate">{inv.campaign}</div>
            <div className="text-[10px] text-muted-foreground truncate">{inv.brand}</div>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2.5 border-b border-border">
          <div className="text-xs font-semibold">{selectedCampaign?.name} — {agencyName}</div>
          <div className="text-[10px] text-muted-foreground">Private to {agencyName} + the brand — no other agency can see this</div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {msgs.length===0 && <div className="text-xs text-muted-foreground italic">No messages yet.</div>}
          {msgs.map(m=>{
            const isMe = m.from===meName;
            return (
              <div key={m.id} className={cx("flex flex-col gap-1", isMe && "items-end")}>
                {m.broadcast && <div className="text-[9px] font-mono uppercase tracking-wide text-urgent mb-0.5">Update from brand</div>}
                <div className={cx("rounded-xl px-4 py-2.5 text-sm max-w-md leading-relaxed",
                  m.broadcast ? "bg-urgent/10 border border-urgent text-foreground" : isMe ? "bg-foreground text-primary-foreground" : "bg-secondary text-foreground"
                )}>{m.text}</div>
                <div className={cx("flex items-center gap-2 text-[10px] text-muted-foreground", isMe && "flex-row-reverse")}>
                  <span className="font-medium">{isMe ? "Me" : m.from}</span>
                  {!isMe && <span>· {m.fromOrg}</span>}
                  <span className="font-mono">{m.ts}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t glass shrink-0">
          <div className="flex gap-3 items-end">
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
              placeholder="Message the brand…" rows={2}
              className="flex-1 bg-input-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none placeholder:text-muted-foreground"/>
            <button onClick={send} className="p-2.5 bg-foreground hover:bg-foreground/90 text-primary-foreground rounded-md transition-colors cursor-pointer shrink-0">
              <Send size={15}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsView() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<"receivable"|"invoices">("receivable");
  const myBookings = BOOKINGS.filter(b=>b.agency===currentUser?.org);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending payout" value={myBookings.filter(b=>b.paymentStatus==="pending").length}/>
        <Stat label="Processing" value={myBookings.filter(b=>b.paymentStatus==="processing").length}/>
        <Stat label="Paid this month" value={myBookings.filter(b=>b.paymentStatus==="paid").length}/>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {(["receivable","invoices"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={cx("px-4 py-2.5 text-sm capitalize border-b-2 -mb-px transition-colors",
              tab===t?"border-foreground text-foreground font-medium":"border-transparent text-muted-foreground hover:text-foreground"
            )}>{t==="receivable"?"Commission Payouts":"Invoices Sent"}</button>
        ))}
      </div>
      {tab==="receivable" && (
        <div className="space-y-2">
          {myBookings.map(b=>{
            const bd = bookingBreakdown(b);
            return (
              <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{b.model}</div>
                  <div className="text-xs text-muted-foreground">{b.campaign} · {b.brand}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-mono">Your commission ({b.agencyPct}%)</div>
                  <div className="font-mono text-sm font-semibold">${bd.agencyFee.toLocaleString()}</div>
                </div>
                <Badge label={b.paymentStatus==="paid"?"Paid":b.paymentStatus==="processing"?"Processing":"Pending"} variant={b.paymentStatus==="paid"?"active":b.paymentStatus==="processing"?"pending":"draft"}/>
              </div>
            );
          })}
        </div>
      )}
      {tab==="invoices" && (
        <div className="space-y-2">
          {myBookings.map(b=>(
            <div key={b.id} className="glass-subtle border rounded-md p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold">{b.campaign}</div>
                <div className="text-xs text-muted-foreground">{b.model} · Shoot {b.shootDate}</div>
              </div>
              <Btn variant={b.paymentStatus==="pending"?"primary":"outline"} size="sm" disabled={b.paymentStatus!=="pending"}>
                {b.paymentStatus==="pending"?"Send Invoice":"Sent"}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgencyApp({ onLogout }: { onLogout: () => void }) {
  const { profile, org } = useAuth();
  const agencyName = org?.name ?? "";
  const [view, setView] = useState<View>("invitations");
  const [roster, setRoster] = useState<RosterModel[]>([]);
  const [submitCampaign, setSubmitCampaign] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (org) fetchAgencyRoster(org.id, org.name).then(r => { if (active) setRoster(r); });
    return () => { active = false; };
  }, [org?.id, org?.name]);

  async function addModel(m: Omit<RosterModel,"id"|"agency">) {
    if (!org) return;
    const { model } = await insertRosterModel(org.id, agencyName, m);
    if (model) setRoster(prev => [...prev, model]);
  }

  return (
    <CurrentUserProvider user={{ name:profile?.fullName ?? "", title:org?.title ?? "", org:agencyName, email:profile?.email ?? "", phone:profile?.phone ?? "", access:org?.accessLevel ?? "basic" }}>
      <div className="h-screen flex bg-background overflow-hidden">
        <aside className="w-52 shrink-0 glass border-r flex flex-col">
          <div className="px-4 h-14 flex items-center border-b border-border gap-2.5">
            <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">{agencyName.trim()[0]?.toUpperCase() ?? "?"}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate flex items-center gap-1.5">{agencyName} <CountryFlag country={ORG_COUNTRY[agencyName]} className="text-xs"/></div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Agency</div>
            </div>
          </div>
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {NAV.map(item=>{
              const NavIcon = item.Icon;
              return (
                <button key={item.id} onClick={()=>setView(item.id)}
                  className={cx("w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-left",
                    view===item.id?"bg-secondary text-foreground font-medium":"text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}>
                  <NavIcon size={15}/>{item.label}
                  {item.count && <span className="ml-auto text-[10px] font-mono bg-foreground text-primary-foreground px-1.5 py-0.5 rounded-full">{item.count}</span>}
                </button>
              );
            })}
          </nav>
          <div className="px-3 py-3 border-t border-border">
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-secondary">
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col min-h-0">
          <TopBar title={NAV.find(n=>n.id===view)?.label ?? ""} sub={`${agencyName} · Agency`}/>
          <div className="flex-1 overflow-auto p-6">
            {view === "invitations" && <InvitationsView onSubmitTalent={(campaign)=>{ setSubmitCampaign(campaign); setView("submit"); }}/>}
            {view === "submit" && <SubmitTalentView roster={roster} onGoToRoster={()=>setView("roster")} initialCampaign={submitCampaign}/>}
            {view === "roster" && <RosterView roster={roster} onAddModel={addModel}/>}
            {view === "payments" && <PaymentsView/>}
            {view === "messaging" && <AgencyMessagingView/>}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}
