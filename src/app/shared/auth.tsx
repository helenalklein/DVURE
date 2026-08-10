import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "../../lib/supabaseClient";
import * as authQueries from "../../lib/queries/auth";
import type { Role } from "./types";

type ProfileRole = "brand_staff" | "agency_staff" | "model" | "crew";
type OrgType = "brand" | "agency";
type AccessLevel = "administrator" | "enhanced" | "basic";

export type VerificationStatus = "unverified" | "pending" | "verified" | "failed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface OrgInfo {
  id: string;
  name: string;
  orgType: OrgType;
  accessLevel: AccessLevel;
  title: string | null;
  verificationStatus: VerificationStatus;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  logoUrl: string | null;
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

export interface CrewInfo {
  id: string;
  fullName: string;
  discipline: string | null;
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
  crewProfile?: CrewInfo;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpBrandOrAgency: (params: { email: string; password: string; fullName: string; role: "brand_staff" | "agency_staff" }) => Promise<{ error: string | null }>;
  signUpIndependentModel: (params: { email: string; password: string; fullName: string }) => Promise<{ error: string | null }>;
  completeOrgSignup: (orgName: string, orgType: OrgType) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_MAP: Record<ProfileRole, Role> = { brand_staff: "brand", agency_staff: "agency", model: "model", crew: "crew" };

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

    if (profileRole === "crew") {
      const { data: crewProfile } = await authQueries.fetchCrewProfile(userId);
      setState({
        status: "signedIn",
        ...base,
        ...(crewProfile ? { crewProfile: { id: crewProfile.id, fullName: crewProfile.full_name, discipline: crewProfile.discipline } } : {}),
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
        verificationStatus: orgRow.verification_status,
        subscriptionStatus: orgRow.subscription_status,
        trialEndsAt: orgRow.trial_ends_at,
        logoUrl: orgRow.logo_url,
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

  // No org-provisioning step after this one, unlike signUpBrandOrAgency
  // — handle_new_user() (0049) creates both profiles and model_profiles
  // rows itself the moment role:model + independent:true land in raw_
  // user_meta_data, since there's no org to stand up for an independent
  // model.
  const signUpIndependentModel = useCallback(
    async (params: { email: string; password: string; fullName: string }) => {
      const { error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: { data: { role: "model", independent: true, full_name: params.fullName } },
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

  // For local edits that land straight in Supabase (a self-update
  // policy, not a signup/session flow) — re-runs the same identity
  // load signIn/onAuthStateChange already does, so a profile edit
  // shows up everywhere it's read from context without a full reload.
  const refreshIdentity = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) await loadIdentity(session.user.id);
  }, [loadIdentity]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUpBrandOrAgency, signUpIndependentModel, completeOrgSignup, signOut, refreshIdentity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
