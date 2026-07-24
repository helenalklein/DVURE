import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { FieldLabel, Btn } from "./shared/ui";
import { useAuth } from "./shared/auth";
import { getInviteByToken, type InviteDetails } from "../lib/queries/invites";
import { supabase } from "../lib/supabaseClient";
import dvureLogo from "../assets/dvure-logo-dark.png";

// Reached by clicking a link an agency generated from their roster (see
// InviteModelModal in AgencyApp.tsx) — public, no session required to
// land here. Sets a password and calls plain client-side signUp(); the
// invite_id in raw_user_meta_data lets handle_new_user() (0009 migration)
// link this new profile back to the exact model_profiles row the agency
// already created, without ever needing a service-role key in the browser.
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { status, signOut } = useAuth();
  const [invite, setInvite] = useState<InviteDetails | null | undefined>(undefined); // undefined = still loading
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setInvite(null); return; }
    getInviteByToken(token).then(setInvite);
  }, [token]);

  async function handleActivate() {
    if (!invite || password.length < 6) return;
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { invite_id: invite.inviteId } },
    });
    setSubmitting(false);
    if (signUpError) { setError(signUpError.message); return; }
    navigate("/model");
  }

  if (invite === undefined) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!invite || invite.status !== "pending" || new Date(invite.expiresAt) < new Date()) {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-6">
        <div className="glass-strong border rounded-xl p-6 max-w-sm text-center space-y-2">
          <div className="text-lg font-semibold">
            {!invite ? "Invite not found" : invite.status === "accepted" ? "This invite has already been used" : invite.status === "revoked" ? "This invite was revoked" : "This invite has expired"}
          </div>
          <div className="text-sm text-muted-foreground">Ask your agency to send you a new invite link.</div>
        </div>
      </div>
    );
  }

  // A visitor already signed in as someone else (e.g. the inviting agency
  // admin testing their own link in the same tab) would otherwise have
  // their session silently replaced by signUp() below.
  if (status === "signedIn") {
    return (
      <div className="h-screen flex items-center justify-center bg-background px-6">
        <div className="glass-strong border rounded-xl p-6 max-w-sm text-center space-y-3">
          <div className="text-lg font-semibold">You're already signed in</div>
          <div className="text-sm text-muted-foreground">Sign out first to accept this invite as {invite.email}.</div>
          <Btn variant="primary" fullWidth onClick={signOut}>Sign out</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={dvureLogo} alt="DVURE" className="w-56 mx-auto"/>
        </div>
        <div className="glass-strong border rounded-xl p-6 shadow-xl space-y-4">
          <div>
            <div className="text-sm font-semibold">
              {invite.orgName ? `${invite.orgName} invited you to DVURE` : "You've been invited to DVURE"}
            </div>
            {invite.modelFullName && (
              <div className="text-xs text-muted-foreground mt-1">Activating the account for {invite.modelFullName}</div>
            )}
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <div className="border border-border rounded-md bg-input-background px-3 py-2.5 text-sm text-muted-foreground">
              {invite.email}
            </div>
          </div>
          <div>
            <FieldLabel>Set a Password</FieldLabel>
            <div className="flex items-center border border-border rounded-md bg-input-background overflow-hidden">
              <Lock size={14} className="text-muted-foreground ml-3 shrink-0"/>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
          <Btn variant="primary" fullWidth disabled={password.length < 6 || submitting} onClick={handleActivate}>
            {submitting ? "Activating…" : "Activate Account"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
