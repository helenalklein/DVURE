import { useState, useEffect, useRef } from "react";
import type { Role } from "./shared/types";
import { cx } from "./shared/ui";
import LoginScreen from "./LoginScreen";
import BrandApp from "./brand/BrandApp";
import AgencyApp from "./agency/AgencyApp";
import ModelApp from "./model/ModelApp";

// One app, one login, three role-based views. Role currently comes from
// DevRoleSwitcher below (or the Try Demo signup flow) rather than a real
// credential check — Milestone B swaps this for a Supabase Auth session
// where the role lives on the account itself.

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const onLogout = () => setRole(null);

  return (
    <>
      {!role && <LoginScreen onLogin={setRole}/>}
      {role === "agency" && <AgencyApp onLogout={onLogout}/>}
      {role === "model" && <ModelApp onLogout={onLogout}/>}
      {role === "brand" && <BrandApp onLogout={onLogout}/>}
      <DevRoleSwitcher role={role} onSelect={setRole}/>
    </>
  );
}

// Dev-only view switcher — the public login form no longer lets a visitor
// pick their own role (that's supposed to come from their actual account),
// but there's still no real backend to log into, so this stays as the one
// way to preview all three workflows without logging out and back in.
// Mounted at the App root, so it floats above every screen including login.
function DevRoleSwitcher({ role, onSelect }: { role: Role | null; onSelect: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
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
