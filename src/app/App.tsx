import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import type { Role } from "./shared/types";
import { cx } from "./shared/ui";
import { useAuth } from "./shared/auth";
import LoginScreen from "./LoginScreen";
import BrandApp from "./brand/BrandApp";
import AgencyApp from "./agency/AgencyApp";
import ModelApp from "./model/ModelApp";
import AcceptInvitePage from "./AcceptInvitePage";

// One app, one login, three role-based views, each at a real URL. Role/org/
// access come from a real Supabase Auth session (src/app/shared/auth.tsx),
// resolved from the profiles/org_memberships/model_profiles tables — not
// local state. Scope is deliberately bounded: only the top-level app and
// one deep link (a brand's specific campaign) are real URL paths; each
// app's own internal tabs/sections stay local React state for now.

export default function App() {
  const { status, appRole, signOut } = useAuth();
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  // Dev-only preview override — lets a developer look at any of the three
  // apps regardless of which role is actually signed in. Screens backed
  // by real data (Moodboard, roster) will show empty states if the
  // override doesn't match the real signed-in org; mock/layout screens
  // render fine either way.
  const [devOverride, setDevOverride] = useState<Role | null>(null);
  const navigate = useNavigate();

  const effectiveRole: Role | null = import.meta.env.DEV && devOverride ? devOverride : appRole ?? null;
  const onLogout = () => { setDevOverride(null); signOut(); };

  if (status === "loading") {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (status === "error") {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500 text-center px-6">
        Something went wrong loading your account. Try refreshing the page.
      </div>
    );
  }

  // Real credentials exist (status==="signedIn") but the Try Demo modal may
  // still be open mid-signup (session live, org not created yet) — same
  // gate the old conditional-render version used, now driving route guards
  // instead of a plain boolean render.
  const canEnterApp = status === "signedIn" && !signupModalOpen;

  return (
    <>
      <Routes>
        <Route path="/login" element={
          canEnterApp
            ? <Navigate to={`/${effectiveRole}`} replace/>
            : <LoginScreen onModalOpenChange={setSignupModalOpen}/>
        }/>
        <Route path="/brand" element={
          <RoleRoute canEnterApp={canEnterApp} match={effectiveRole==="brand"} effectiveRole={effectiveRole}>
            <BrandApp onLogout={onLogout}/>
          </RoleRoute>
        }/>
        <Route path="/brand/campaigns/:id" element={
          <RoleRoute canEnterApp={canEnterApp} match={effectiveRole==="brand"} effectiveRole={effectiveRole}>
            <BrandApp onLogout={onLogout}/>
          </RoleRoute>
        }/>
        <Route path="/agency" element={
          <RoleRoute canEnterApp={canEnterApp} match={effectiveRole==="agency"} effectiveRole={effectiveRole}>
            <AgencyApp onLogout={onLogout}/>
          </RoleRoute>
        }/>
        <Route path="/model" element={
          <RoleRoute canEnterApp={canEnterApp} match={effectiveRole==="model"} effectiveRole={effectiveRole}>
            <ModelApp onLogout={onLogout}/>
          </RoleRoute>
        }/>
        <Route path="/accept-invite/:token" element={<AcceptInvitePage/>}/>
        <Route path="/" element={<Navigate to={canEnterApp ? `/${effectiveRole}` : "/login"} replace/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
      {import.meta.env.DEV && (
        <DevRoleSwitcher role={effectiveRole} onSelect={(r) => { setDevOverride(r); navigate(`/${r}`); }}/>
      )}
    </>
  );
}

// Gates a role-specific app behind both "is anyone really allowed in right
// now" (signed in, not mid-signup) and "is this the URL for the role
// that's actually signed in" — typing /agency in the address bar while
// signed in as a brand bounces back rather than rendering the wrong app.
function RoleRoute({ canEnterApp, match, effectiveRole, children }: {
  canEnterApp: boolean; match: boolean; effectiveRole: Role | null; children: React.ReactNode;
}) {
  if (!canEnterApp) return <Navigate to="/login" replace/>;
  if (!match) return <Navigate to={effectiveRole ? `/${effectiveRole}` : "/login"} replace/>;
  return <>{children}</>;
}

// Dev-only view switcher — lets a developer preview all three role-based
// workflows without needing separate logins for each. Mounted at the App
// root, so it floats above every screen including login.
function DevRoleSwitcher({ role, onSelect }: { role: Role | null; onSelect: (r: Role) => void }) {
  const [open, setOpen] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const roles: { id: Role; label: string }[] = [
    { id:"brand",  label:"Brand"  },
    { id:"agency", label:"Agency" },
    { id:"model",  label:"Model"  },
  ];

  return (
    <div ref={wrapRef} className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center">
      {open && (
        <div className="mb-2 glass-strong border rounded-md shadow-xl p-1.5 flex gap-1">
          {roles.map(r => (
            <button key={r.id} onClick={()=>{ onSelect(r.id); setOpen(false); }}
              className={cx("px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                role===r.id ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>{r.label}</button>
          ))}
        </div>
      )}
      <button onClick={()=>setOpen(p=>!p)}
        className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/60 transition-colors cursor-pointer">
        Dev View: {role ?? "Login"}
      </button>
    </div>
  );
}
