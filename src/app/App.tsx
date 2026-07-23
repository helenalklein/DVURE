import { useState, useEffect, useRef } from "react";
import type { Role } from "./shared/types";
import { cx } from "./shared/ui";
import { useAuth } from "./shared/auth";
import LoginScreen from "./LoginScreen";
import BrandApp from "./brand/BrandApp";
import AgencyApp from "./agency/AgencyApp";
import ModelApp from "./model/ModelApp";

// One app, one login, three role-based views. Role/org/access come from
// a real Supabase Auth session (src/app/shared/auth.tsx), resolved from
// the profiles/org_memberships/model_profiles tables — not local state.

export default function App() {
  const { status, appRole, signOut } = useAuth();
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  // Dev-only preview override — lets a developer look at any of the three
  // apps regardless of which role is actually signed in. Screens backed
  // by real data (Moodboard, roster) will show empty states if the
  // override doesn't match the real signed-in org; mock/layout screens
  // render fine either way.
  const [devOverride, setDevOverride] = useState<Role | null>(null);

  const effectiveRole: Role | null = import.meta.env.DEV && devOverride ? devOverride : appRole ?? null;
  const onLogout = () => { setDevOverride(null); signOut(); };

  const showLogin = status !== "signedIn" || signupModalOpen;

  return (
    <>
      {status === "loading" && (
        <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      )}
      {status === "error" && (
        <div className="h-screen flex items-center justify-center text-sm text-red-500 text-center px-6">
          Something went wrong loading your account. Try refreshing the page.
        </div>
      )}
      {status !== "loading" && status !== "error" && showLogin && <LoginScreen onModalOpenChange={setSignupModalOpen}/>}
      {status === "signedIn" && !signupModalOpen && effectiveRole === "agency" && <AgencyApp onLogout={onLogout}/>}
      {status === "signedIn" && !signupModalOpen && effectiveRole === "model" && <ModelApp onLogout={onLogout}/>}
      {status === "signedIn" && !signupModalOpen && effectiveRole === "brand" && <BrandApp onLogout={onLogout}/>}
      {import.meta.env.DEV && <DevRoleSwitcher role={effectiveRole} onSelect={setDevOverride}/>}
    </>
  );
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
