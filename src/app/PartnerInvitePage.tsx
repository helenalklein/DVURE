import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, Check, ChevronLeft } from "lucide-react";
import { FieldLabel, Btn, TextInput, DvureSignature } from "./shared/ui";
import { useAuth } from "./shared/auth";
import { fetchPartnerInviteByToken, acceptPartnerInvite, type PartnerInviteDetails } from "../lib/queries/partnerships";
import dvureLogo from "../assets/dvure-logo-dark.png";

// Public landing page for a real partner invite (see 0035_partner_invites.sql
// and the Network tab in BrandApp.tsx / AgencyApp.tsx). Handles all four
// shapes this can land in: no session yet (sign in or create an account,
// locked to the invite's expected org type — you can't accidentally
// accept an agency invite as a brand); signed in but the wrong kind of
// account; signed in as the right kind but not yet eligible ("demos
// don't have partner access" — an agency needs an active subscription, a
// brand needs to be verified); and signed in and eligible, which accepts
// immediately.
type Mode = "signIn" | "createAccount";

export default function PartnerInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { status, appRole, org, signIn, signUpBrandOrAgency, completeOrgSignup, signOut, refreshIdentity } = useAuth();

  const [invite, setInvite] = useState<PartnerInviteDetails | null | undefined>(undefined); // undefined = loading
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setInvite(null); return; }
    fetchPartnerInviteByToken(token).then(setInvite);
  }, [token]);

  const attemptAccept = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    setGateMessage(null);
    const { error: err } = await acceptPartnerInvite(token);
    setBusy(false);
    if (err) {
      if (err.includes("needs an active subscription") || err.includes("needs to be verified")) {
        setGateMessage(err);
      } else {
        setError(err);
      }
      return;
    }
    setAccepted(true);
    refreshIdentity();
  }, [token, refreshIdentity]);

  // Signed in as the right kind of account and not already accepted —
  // try immediately rather than making them click twice.
  useEffect(() => {
    if (status === "signedIn" && org && invite && invite.status === "pending" && org.orgType === invite.inviteeOrgType && !accepted && !busy && !error && !gateMessage) {
      attemptAccept();
    }
  }, [status, org, invite, accepted, busy, error, gateMessage, attemptAccept]);

  if (invite === undefined || status === "loading") {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!invite || invite.status !== "pending" || new Date(invite.expiresAt) < new Date()) {
    return (
      <Shell>
        <div className="text-heading text-lg">
          {!invite ? "Invite not found" : invite.status === "accepted" ? "This invite has already been used" : invite.status === "revoked" ? "This invite was withdrawn" : "This invite has expired"}
        </div>
        <div className="text-sm text-muted-foreground">Ask whoever sent you this link for a new one.</div>
      </Shell>
    );
  }

  if (accepted) {
    return (
      <Shell>
        <div className="w-12 h-12 rounded-full bg-foreground text-primary-foreground flex items-center justify-center mx-auto">
          <Check size={20}/>
        </div>
        <div className="text-heading text-lg">You're partnered with {invite.invitingOrgName}</div>
        <Btn variant="primary" fullWidth onClick={() => navigate(`/${appRole}`)}>Enter DVURE</Btn>
      </Shell>
    );
  }

  // Signed in as the wrong kind of account for this invite (e.g. a model,
  // crew, or the opposite org type).
  if (status === "signedIn" && appRole !== invite.inviteeOrgType) {
    return (
      <Shell>
        <div className="text-heading text-lg">Wrong account type</div>
        <div className="text-sm text-muted-foreground">
          This invite is for {invite.inviteeOrgType === "agency" ? "an agency" : "a brand"} account, but you're signed in as {appRole ?? "something else"}. Sign out and use (or create) {invite.inviteeOrgType === "agency" ? "an agency" : "a brand"} account instead.
        </div>
        <Btn variant="primary" fullWidth onClick={signOut}>Sign out</Btn>
      </Shell>
    );
  }

  // Signed in as the right kind of account, but the gate blocked it.
  if (status === "signedIn" && gateMessage) {
    return (
      <Shell>
        <div className="text-heading text-lg">Almost there</div>
        <div className="text-sm text-muted-foreground">{gateMessage}.</div>
        <div className="text-xs text-muted-foreground">
          {invite.inviteeOrgType === "agency"
            ? "Add a payment method from your Agency Profile, then come back to this link."
            : "Contact support@dvure.com to get verified, then come back to this link."}
        </div>
        <div className="flex gap-2">
          <Btn variant="primary" fullWidth onClick={() => navigate(`/${appRole}`)}>Go to DVURE</Btn>
          <Btn variant="outline" fullWidth onClick={attemptAccept} disabled={busy}>{busy ? "Checking…" : "Try again"}</Btn>
        </div>
      </Shell>
    );
  }

  if (status === "signedIn" && busy) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Setting up your partnership…</div>;
  }

  if (status === "signedIn" && error) {
    return (
      <Shell>
        <div className="text-heading text-lg">Something went wrong</div>
        <div className="text-sm text-red-500">{error}</div>
        <Btn variant="primary" fullWidth onClick={attemptAccept}>Try again</Btn>
      </Shell>
    );
  }

  // Not signed in yet — sign in or create an account, locked to the
  // invite's expected org type so they can't end up on the wrong side.
  async function handleSignIn() {
    setBusy(true); setError(null);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  async function handleCreateAccount() {
    setBusy(true); setError(null);
    const { error: signUpErr } = await signUpBrandOrAgency({
      email, password, fullName, role: invite!.inviteeOrgType === "brand" ? "brand_staff" : "agency_staff",
    });
    if (signUpErr) { setBusy(false); setError(signUpErr); return; }
    const { error: orgErr } = await completeOrgSignup(companyName, invite!.inviteeOrgType);
    setBusy(false);
    if (orgErr) { setError(orgErr); return; }
    // Once org exists, the signedIn effect above picks it up and attempts
    // acceptance automatically (it'll hit the gate immediately for a
    // brand-new account — expected, since demos don't have partner
    // access — and show the gateMessage state above).
  }

  return (
    <Shell wide>
      <div className="text-heading text-lg">{invite.invitingOrgName} invited you to partner on <DvureSignature size={13}/></div>
      <div className="text-xs text-muted-foreground -mt-2">As {invite.inviteeOrgType === "agency" ? "an agency" : "a brand"} account{invite.inviteeOrgType === "agency" ? " ($99/mo)" : " (free)"}.</div>

      <div className="flex items-center gap-1 border border-border rounded-md p-0.5 w-fit mx-auto">
        {(["signIn", "createAccount"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setError(null); }}
            className={`px-3 py-1 text-xs rounded-sm cursor-pointer transition-colors ${mode === m ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            {m === "signIn" ? "I have an account" : "Create account"}
          </button>
        ))}
      </div>

      {mode === "signIn" ? (
        <div className="space-y-3 text-left">
          <div>
            <FieldLabel>Email</FieldLabel>
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <Mail size={14} className="text-muted-foreground ml-3 shrink-0"/>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <Lock size={14} className="text-muted-foreground ml-3 shrink-0"/>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e=>{ if (e.key==="Enter") handleSignIn(); }}
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>
          {error && <div className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12}/> {error}</div>}
          <Btn variant="primary" fullWidth disabled={!email || !password || busy} onClick={handleSignIn}>
            {busy ? "Signing in…" : "Sign In & Accept"}
          </Btn>
        </div>
      ) : (
        <div className="space-y-3 text-left">
          <TextInput label={invite.inviteeOrgType === "brand" ? "Brand Name" : "Agency Name"} placeholder="" value={companyName} onChange={e=>setCompanyName(e.target.value)}/>
          <TextInput label="Your Name" placeholder="" value={fullName} onChange={e=>setFullName(e.target.value)}/>
          <TextInput label="Work Email" type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}/>
          <TextInput label="Password" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)}/>
          {error && <div className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12}/> {error}</div>}
          <Btn variant="primary" fullWidth disabled={!companyName || !fullName || !email || password.length < 6 || busy} onClick={handleCreateAccount}>
            {busy ? "Creating…" : "Create Account"}
          </Btn>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="h-screen flex items-center justify-center bg-background px-6">
      <div className={wide ? "w-full max-w-sm" : "max-w-sm"}>
        <div className="text-center mb-6">
          <img src={dvureLogo} alt="DVURE" className="w-40 mx-auto"/>
        </div>
        <div className="glass-strong border rounded-xl p-6 shadow-xl space-y-4 text-center">
          {children}
        </div>
        <button onClick={() => navigate("/login")} className="mt-4 mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
          <ChevronLeft size={12}/> Back to sign in
        </button>
      </div>
    </div>
  );
}
