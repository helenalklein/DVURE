import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Send, Users } from "lucide-react";
import { TopBar, Stat, FieldLabel, TextInput, Btn, Badge, cx } from "./ui";
import { useAuth } from "./auth";
import { fetchMyPartners, fetchMySentInvites, createPartnerInvite, type Partner, type SentInvite } from "../../lib/queries/partnerships";

// Real "Invite Partner" flow — replaces the old fake Network tab
// (BrandApp's Network component was a hardcoded 4-agency list whose
// "Add" button only touched local React state) and gives Agency an
// equivalent screen for the first time. Closed-loop by design per
// direct instruction: this pairs orgs that already know each other, not
// an open directory — see 0035_partner_invites.sql's own comment for why.
function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/partner-invite/${token}`;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
    >
      {copied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy link</>}
    </button>
  );
}

export default function NetworkView() {
  const { org } = useAuth();
  const otherSide = org?.orgType === "brand" ? "Agencies" : "Brands";
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [invites, setInvites] = useState<SentInvite[] | null>(null);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!org) return;
    fetchMyPartners(org.id, org.orgType).then(setPartners);
    fetchMySentInvites(org.id).then(setInvites);
  }, [org]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSend() {
    if (!email) return;
    setSending(true);
    setError(null);
    setLastToken(null);
    const { token, error: err } = await createPartnerInvite(email, orgName);
    setSending(false);
    if (err || !token) { setError(err ?? "Couldn't create invite."); return; }
    setLastToken(token);
    setEmail(""); setOrgName("");
    reload();
  }

  if (!org) return null;

  const pending = (invites ?? []).filter(i => i.status === "pending" && new Date(i.expiresAt) > new Date());

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar title="Network" sub={`${otherSide === "Agencies" ? "Agency" : "Brand"} relationships and partners`}/>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Stat label="Partners" value={String((partners ?? []).length)} sub={`Active ${otherSide.toLowerCase()}`}/>
          <Stat label="Pending Invites" value={String(pending.length)} sub="Awaiting response"/>
        </div>

        <div className="glass-subtle border rounded-md p-4 mb-6 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-1.5"><Send size={13}/> Invite Partner</div>
          <div className="text-xs text-muted-foreground">
            Only for {otherSide.toLowerCase()} you already work with — enter their info, send them the link yourself, and they'll be partnered once they accept.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Contact Email</FieldLabel>
              <TextInput type="email" placeholder="contact@partner.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            </div>
            <div>
              <FieldLabel>{`${otherSide === "Agencies" ? "Agency" : "Brand"} Name (optional)`}</FieldLabel>
              <TextInput placeholder={otherSide === "Agencies" ? "e.g. Halstead Model Management" : "e.g. Vellani"} value={orgName} onChange={e=>setOrgName(e.target.value)}/>
            </div>
          </div>
          {error && <div className="text-xs text-urgent bg-urgent/5 border border-urgent rounded-md px-3 py-2">{error}</div>}
          {lastToken && (
            <div className="flex items-center justify-between text-xs bg-secondary border border-border rounded-md px-3 py-2">
              <span className="text-muted-foreground">Invite created — send this link to your partner:</span>
              <CopyLink token={lastToken}/>
            </div>
          )}
          <Btn variant="primary" size="sm" disabled={!email || sending} onClick={handleSend}>
            {sending ? "Sending…" : "Send Invite"}
          </Btn>
        </div>

        {pending.length > 0 && (
          <div className="mb-6">
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-2">Pending</div>
            <div className="space-y-2">
              {pending.map(i => (
                <div key={i.id} className="glass-subtle border rounded-md px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.inviteeOrgName || i.inviteeEmail}</div>
                    <div className="text-xs text-muted-foreground truncate">{i.inviteeEmail}</div>
                  </div>
                  <CopyLink token={i.token}/>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-2">Partners</div>
        {partners === null && <div className="text-sm text-muted-foreground">Loading…</div>}
        {partners !== null && partners.length === 0 && (
          <div className="text-sm text-muted-foreground">No partners yet — invite one above.</div>
        )}
        <div className="space-y-2">
          {(partners ?? []).map(p => (
            <div key={p.orgId} className={cx("glass-subtle border rounded-md p-4 flex items-center gap-4")}>
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center shrink-0"><Users size={16} className="text-muted-foreground"/></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">Partnered since {new Date(p.since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
              <Badge label="Active" variant="success"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
