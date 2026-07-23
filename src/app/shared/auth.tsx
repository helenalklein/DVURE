import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import * as authQueries from "../../lib/queries/auth";
import type { Role } from "./types";

type ProfileRole = "brand_staff" | "agency_staff" | "model";
type OrgType = "brand" | "agency";
type AccessLevel = "administrator" | "enhanced" | "basic";

export interface OrgInfo {
  id: string;
  name: string;
  orgType: OrgType;
  accessLevel: AccessLevel;
  title: string | null;
}

export interface ModelAgencyInfo {
  orgId: string;
  name: string;
  relationshipType: "mother" | "boutique";
}

export interface ModelInfo {
  id: string;
  fullName: string;
  location: string | null;
}

interface AuthState {
  status: "loading" | "signedOut" | "signedIn" | "error";
  errorMessage?: string;
  profileRole?: ProfileRole;
  appRole?: Role;
  profile?: { id: string; fullName: string; email: string; phone: string | null };
  org?: OrgInfo;
  modelProfile?: ModelInfo;
  modelAgencies?: ModelAgencyInfo[];
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpBrandOrAgency: (params: { email: string; password: string; fullName: string; role: "brand_staff" | "agency_staff" }) => Promise<{ error: string | null }>;
  completeOrgSignup: (orgName: string, orgType: OrgType) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_MAP: Record<ProfileRole, Role> = { brand_staff: "brand", agency_staff: "agency", model: "model" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const loadIdentity = useCallback(async (userId: string) => {
    const { data: profile, error: profileError } = await authQueries.fetchProfile(userId);
    if (profileError || !profile) {
      setState({ status: "error", errorMessage: "Couldn't load your account. Try refreshing the page." });
      return;
    }

    const profileRole = profile.role as ProfileRole;
    const base = {
      profileRole,
      appRole: ROLE_MAP[profileRole],
      profile: { id: profile.id, fullName: profile.full_name ?? "", email: profile.email ?? "", phone: profile.phone },
    };

    if (profileRole === "model") {
      const { data: modelProfile } = await authQueries.fetchModelProfile(userId);
      if (!modelProfile) {
        setState({ status: "signedIn", ...base });
        return;
      }
      const { data: rels } = await authQueries.fetchModelAgencies(modelProfile.id);
      setState({
        status: "signedIn",
        ...base,
        modelProfile: { id: modelProfile.id, fullName: modelProfile.full_name, location: modelProfile.location },
        modelAgencies: (rels ?? []).map((r: any) => ({
          orgId: r.organizations.id,
          name: r.organizations.name,
          relationshipType: r.relationship_type,
        })),
      });
      return;
    }

    const { data: membership } = await authQueries.fetchOrgMembership(userId);
    if (!membership) {
      // Signed in but no org yet — the moment between signUp() and
      // completeOrgSignup() during Try Demo signup.
      setState({ status: "signedIn", ...base });
      return;
    }
    const orgRow: any = membership.organizations;
    setState({
      status: "signedIn",
      ...base,
      org: {
        id: orgRow.id,
        name: orgRow.name,
        orgType: orgRow.org_type,
        accessLevel: membership.access_level,
        title: membership.title,
      },
    });
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) loadIdentity(session.user.id);
      else setState({ status: "signedOut" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadIdentity]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? "Invalid email or password." : null };
  }, []);

  const signUpBrandOrAgency = useCallback(
    async (params: { email: string; password: string; fullName: string; role: "brand_staff" | "agency_staff" }) => {
      const { error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: { data: { role: params.role, full_name: params.fullName } },
      });
      return { error: error ? error.message : null };
    },
    []
  );

  const completeOrgSignup = useCallback(
    async (orgName: string, orgType: OrgType) => {
      const { error } = await supabase.rpc("complete_org_signup", { p_org_name: orgName, p_org_type: orgType });
      if (error) return { error: error.message };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await loadIdentity(session.user.id);
      return { error: null };
    },
    [loadIdentity]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUpBrandOrAgency, completeOrgSignup, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
