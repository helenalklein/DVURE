import { useState } from "react";
import { Mail, Lock, Building, Users, User } from "lucide-react";
import type { Role } from "./shared/types";
import { FieldLabel } from "./shared/ui";

// One login form for everyone — role comes from the account itself once
// Supabase Auth is wired in (Milestone B). Until then, the three buttons
// below stand in for "which account did you sign in as" during local dev.

export default function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const demoRoles: { id: Role; label: string; Icon: typeof Building }[] = [
    { id:"brand",  label:"Brand",  Icon:Building },
    { id:"agency", label:"Agency", Icon:Users    },
    { id:"model",  label:"Model",  Icon:User     },
  ];

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-foreground rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground text-2xl font-bold tracking-tight">C</span>
          </div>
          <div className="text-2xl font-semibold tracking-tight">CasFlow</div>
          <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">Talent Operating System</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
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
                className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>

          <div className="pt-1 border-t border-border">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-3 mb-2">
              Demo access — real accounts land next milestone
            </div>
            <div className="grid grid-cols-3 gap-2">
              {demoRoles.map(r => {
                const RIcon = r.Icon;
                return (
                  <button key={r.id} onClick={()=>onLogin(r.id)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-md border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer">
                    <RIcon size={16}/>
                    <span className="text-xs font-medium">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <button className="hover:text-foreground cursor-pointer underline underline-offset-2">Forgot password?</button>
          </div>
        </div>

        <div className="text-center mt-5 text-xs text-muted-foreground">
          New to CasFlow?{" "}
          <button className="text-foreground font-medium cursor-pointer hover:underline">Request access</button>
        </div>
      </div>
    </div>
  );
}
