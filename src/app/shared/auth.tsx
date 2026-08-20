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
  // Required at signup (complete_org_signup + set_signup_title_and_address,
  // 0098) so the brand's own contract signature block can auto-fill a
  // real value instead of asking every sender to type it into a blank
  // template. Nullable at the DB level for pre-existing orgs.
  address: string | null;
  verificationStatus: VerificationStatus;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  logoUrl: string | null;
  paymentLocked: boolean;
  // Purely descriptive (spec §20) — never read by any RLS/RPC decision.
  selfDescribedServices: string | null;
  // Set once at signup (complete_org_signup) for every agency during
  // the pilot — locks in the current subscription rate even after a
  // later price increase. Never true for brands (brands don't pay a
  // subscription at all, see accessGate.ts).
  foundingMember: boolean;
  // Fallback finalization window (hours after submission_close) for any
  // campaign that hasn't set its own override — see Campaign.
  // finalizationHours (0088). Brand-only setting, edited in Settings >
  // Organization; defaults to 48 server-side.
  defaultFinalizationHours: number;
  // Null means "hasn't chosen a contract template yet" (0092) — the
  // exact state needsContractTemplate() (accessGate.ts) gates on. Never
  // auto-defaulted at signup; picking one (even DVURE's own) is meant
  // to be an explicit choice.
  defaultContractTemplateId: string | null;
}

export interface ModelAgencyInfo {
  orgId: string;
  name: string;
  // Free text (agencies describe the relationship however fits, see
  // AddModelModal) — is_mother_agency is the reliable boolean signal,
  // not a string match against this.
  relationshipType: string;
  isMotherAgency: boolean;
}

export interface ModelInfo {
  id: string;
  fullName: string;
  location: string | null;
  photoUrl: string | null;
  height: string | null;
  bust: string | null;
  waist: string | null;
  dress: string | null;
  dayRate: number | null;
  email: string | null;
  dateOfBirth: string | null;
  guardianName: string | null;
  sex: string | null;
  pronouns: string | null;
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
  completeOrgSignup: (orgName: string, orgType: OrgType, title: string, address: string) => Promise<{ error: string | null }>;
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
        modelProfile: {
          id: modelProfile.id, fullName: modelProfile.full_name, location: modelProfile.location,
          photoUrl: modelProfile.photo_url, height: modelProfile.height, bust: modelProfile.bust,
          waist: modelProfile.waist, dress: modelProfile.dress, dayRate: modelProfile.default_day_rate,
          email: modelProfile.email, dateOfBirth: modelProfile.date_of_birth, guardianName: modelProfile.guardian_name,
          sex: modelProfile.sex, pronouns: modelProfile.pronouns,
        },
        modelAgencies: (rels ?? []).map((r: any) => ({
          orgId: r.organizations.id,
          name: r.organizations.name,
          relationshipType: r.relationship_type,
          isMotherAgency: !!r.is_mother_agency,
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
        address: orgRow.address,
        verificationStatus: orgRow.verification_status,
        subscriptionStatus: orgRow.subscription_status,
        trialEndsAt: orgRow.trial_ends_at,
        logoUrl: orgRow.logo_url,
        paymentLocked: !!orgRow.payment_locked,
        selfDescribedServices: orgRow.self_described_services,
        foundingMember: !!orgRow.founding_member,
        defaultFinalizationHours: orgRow.default_finalization_hours ?? 48,
        defaultContractTemplateId: orgRow.default_contract_template_id ?? null,
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
    async (orgName: string, orgType: OrgType, title: string, address: string) => {
      const { error } = await supabase.rpc("complete_org_signup", { p_org_name: orgName, p_org_type: orgType });
      if (error) return { error: error.message };
      // Separate, additive call (0098) rather than passing title/address
      // straight into complete_org_signup — see that migration's own
      // comment for why the two are kept apart. Non-fatal if it fails:
      // the org itself is already created at this point, and title/
      // address can still be fixed later in Settings.
      await supabase.rpc("set_signup_title_and_address", { p_title: title, p_org_address: address });
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
