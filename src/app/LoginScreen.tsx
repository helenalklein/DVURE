import { useState, useEffect } from "react";
import { Mail, Lock, Building, Users, User, X, ChevronLeft, ChevronRight, Check, Sparkles, AlertCircle } from "lucide-react";
import { FieldLabel, Modal, Btn, TextInput } from "./shared/ui";
import { useAuth } from "./shared/auth";
import dvureLogo from "../assets/dvure-logo-dark.png";

type SignupStep = "role" | "form" | "provisioning" | "success";
type SignupRole = "brand" | "agency";

// One login form for everyone — role, org, and access level all come
// from the real signed-in account (src/app/shared/auth.tsx) once the
// session resolves, not from anything picked here. The picker that used
// to let a visitor jump into any of the three role views now lives in a
// dev-only control mounted at the App root (App.tsx), not on this form.

export default function LoginScreen({ onModalOpenChange }: { onModalOpenChange: (open: boolean) => void }) {
  const { signIn, signUpBrandOrAgency, completeOrgSignup } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const [signup, setSignup] = useState<SignupStep | null>(null);
  const [signupRole, setSignupRole] = useState<SignupRole>("brand");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);

  useEffect(() => {
    onModalOpenChange(signup !== null);
  }, [signup, onModalOpenChange]);

  function closeSignup() {
    setSignup(null);
    setSignupError(null);
    setCompanyName(""); setFullName(""); setWorkEmail(""); setSignupPassword("");
  }

  async function handleSignIn() {
    setSignInError(null);
    setSignInLoading(true);
    const { error } = await signIn(email, password);
    setSignInLoading(false);
    if (error) setSignInError(error);
  }

  async function runProvisioning() {
    setSignupError(null);
    const orgType = signupRole === "brand" ? "brand" : "agency";
    const { error: orgError } = await completeOrgSignup(companyName, orgType);
    if (orgError) {
      setSignupError(orgError);
      return;
    }
    setSignup("success");
  }

  async function handleStartTrial() {
    setSignupError(null);
    setSignup("provisioning");
    const { error } = await signUpBrandOrAgency({
      email: workEmail,
      password: signupPassword,
      fullName,
      role: signupRole === "brand" ? "brand_staff" : "agency_staff",
    });
    if (error) {
      setSignupError(error);
      setSignup("form");
      return;
    }
    await runProvisioning();
  }

  const passwordTooShort = signupPassword.length > 0 && signupPassword.length < 6;

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={dvureLogo} alt="DVURE" className="w-56 mx-auto"/>
        </div>

        <div className="glass-strong border rounded-xl p-6 shadow-xl space-y-4">
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

          {signInError && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={12}/> {signInError}
            </div>
          )}

          <Btn variant="primary" fullWidth disabled={!email || !password || signInLoading} onClick={handleSignIn}>
            {signInLoading ? "Signing in…" : "Sign In"}
          </Btn>

          <div className="text-center text-xs text-muted-foreground">
            <button className="hover:text-foreground cursor-pointer underline underline-offset-2">Forgot password?</button>
          </div>
        </div>

        <div className="text-center mt-5 text-xs text-muted-foreground">
          New to DVURE?{" "}
          <button onClick={()=>setSignup("role")} className="text-foreground font-medium cursor-pointer hover:underline">Try Demo</button>
        </div>
      </div>

      {signup && (
        <Modal onClose={closeSignup} maxWidth="max-w-md">
          {signup === "role" && (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Try DVURE</div>
                  <div className="text-sm text-muted-foreground mt-0.5">Start a 14-day free trial — no credit card required.</div>
                </div>
                <button onClick={closeSignup} className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"><X size={16}/></button>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">I'm an authorized representative for a</div>
                {([
                  { id:"brand" as SignupRole,  label:"Brand",  desc:"Book and manage talent for your campaigns",           Icon:Building },
                  { id:"agency" as SignupRole, label:"Agency", desc:"Submit talent and manage bookings for your roster",   Icon:Users    },
                ]).map(opt => {
                  const OIcon = opt.Icon;
                  return (
                    <button key={opt.id} onClick={()=>{ setSignupRole(opt.id); setSignup("form"); }}
                      className="w-full flex items-center gap-3 p-4 rounded-md border border-border hover:border-foreground transition-colors text-left cursor-pointer">
                      <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                        <OIcon size={16}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0"/>
                    </button>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-border flex items-start gap-2.5">
                <User size={13} className="text-muted-foreground mt-0.5 shrink-0"/>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Are you a model? Models are added to DVURE by their agency — contact your agency directly to get connected.
                </div>
              </div>
            </div>
          )}

          {signup === "form" && (
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button onClick={()=>{ setSignupError(null); setSignup("role"); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 cursor-pointer">
                    <ChevronLeft size={12}/> Back
                  </button>
                  <div className="text-lg font-semibold">Create your {signupRole==="brand"?"brand":"agency"} account</div>
                </div>
                <button onClick={closeSignup} className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"><X size={16}/></button>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-wide">
                <Sparkles size={11}/> 14-day free trial · No credit card required
              </div>
              <div className="space-y-3 pt-1">
                <TextInput label={signupRole==="brand"?"Brand Name":"Agency Name"} value={companyName} onChange={e=>setCompanyName(e.target.value)}
                  placeholder={signupRole==="brand"?"e.g. Acne Studios":"e.g. Elite Model Management"}/>
                <TextInput label="Your Name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Jordan Lee"/>
                <TextInput label="Work Email" type="email" value={workEmail} onChange={e=>setWorkEmail(e.target.value)} placeholder="you@company.com"/>
                <TextInput label="Password" type="password" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} placeholder="••••••••"/>
                {passwordTooShort && <div className="text-xs text-red-500">Password must be at least 6 characters.</div>}
              </div>
              {signupError && (
                <div className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={12}/> {signupError}
                </div>
              )}
              <Btn variant="primary" fullWidth
                disabled={!companyName || !fullName || !workEmail || !signupPassword || passwordTooShort}
                onClick={handleStartTrial}>
                Start Free Trial
              </Btn>
            </div>
          )}

          {signup === "provisioning" && (
            <div className="p-6 space-y-4 text-center">
              {signupError ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle size={20}/>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Almost there</div>
                    <div className="text-sm text-muted-foreground mt-1">Your account was created, but setting up your organization failed: {signupError}</div>
                  </div>
                  <Btn variant="primary" fullWidth onClick={runProvisioning}>Retry</Btn>
                </>
              ) : (
                <div className="text-sm text-muted-foreground py-6">Setting up your account…</div>
              )}
            </div>
          )}

          {signup === "success" && (
            <div className="p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-foreground text-primary-foreground flex items-center justify-center mx-auto">
                <Check size={20}/>
              </div>
              <div>
                <div className="text-lg font-semibold">You're all set</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Your 14-day trial of DVURE {signupRole==="brand"?"Brand":"Agency"} has started for {companyName || (signupRole==="brand"?"your brand":"your agency")}. Explore the platform below — no setup required.
                </div>
              </div>
              <Btn variant="primary" fullWidth onClick={closeSignup}>Enter DVURE</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
