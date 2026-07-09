export type Role = "brand" | "agency" | "model";

export type SubmissionStage = "submitted" | "approved" | "rejected" | "booked";

export type Availability = "available" | "pending" | "unavailable";

export type PaymentStatus = "pending" | "processing" | "paid";

export interface Talent {
  id: number;
  name: string;
  agency: string;
  location: string;
  rate: string;
  stage: SubmissionStage;
  avail: Availability;
  note: string;
  height: string;
  bust: string;
  waist: string;
  dress: string;
  exp: string;
  score: number;
}

export type IconFn = (props: { size?: number; className?: string }) => JSX.Element | null;

// A model on an agency's roster. Agencies add models (invite-style,
// like a brand adding a teammate) — models don't self-register.
// This becomes the `talent_profiles` table in Milestone B, with
// campaign submissions as a separate table referencing it.
export interface RosterModel {
  id: number;
  name: string;
  email: string;
  agency: string;
  location: string;
  rate: string;
  height: string;
  exp: string;
}
