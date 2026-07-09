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
