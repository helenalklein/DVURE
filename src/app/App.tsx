import { useState } from "react";
import type { Role } from "./shared/types";
import LoginScreen from "./LoginScreen";
import BrandApp from "./brand/BrandApp";
import AgencyApp from "./agency/AgencyApp";
import ModelApp from "./model/ModelApp";

// One app, one login, three role-based views. Role currently comes from
// which demo button was clicked on the login screen — Milestone B swaps
// this for a real Supabase Auth session where the role lives on the
// account itself.

export default function App() {
  const [role, setRole] = useState<Role | null>(null);

  if (!role) return <LoginScreen onLogin={setRole}/>;

  const onLogout = () => setRole(null);

  if (role === "agency") return <AgencyApp onLogout={onLogout}/>;
  if (role === "model")  return <ModelApp onLogout={onLogout}/>;
  return <BrandApp onLogout={onLogout}/>;
}
