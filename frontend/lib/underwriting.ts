import type { Prediction } from "@/lib/api";

export type ApplicantStatus = "Not Assessed" | "Running" | "Completed";
export type Decision = "Approved" | "Declined" | "Referred";

export interface Applicant {
  id: string;
  caseId: number;
  name: string;
  income: number;
  loan_amount: number;
  employment: "Full-time" | "Part-time" | "Self-employed" | "Contract" | "Retired" | "Unemployed";
  status: ApplicantStatus;
}

export interface AssessmentRecord extends Pick<Prediction, "probability" | "risk_band" | "top_features"> {
  id: string;
  applicationId?: string;
  caseId: number;
  applicantId: string;
  applicantName: string;
  requestedAmount?: number;
  createdAt: string;
  decision?: Decision;
}

/** `saved` carries the ids Aurora assigned, so the record matches what a reload will return. */
export function assessmentFromPrediction(
  prediction: Prediction,
  applicant: Applicant,
  saved: { id: string; applicationId: string; applicantId: string },
): AssessmentRecord {
  return {
    ...saved,
    caseId: prediction.case_id,
    applicantName: applicant.name,
    requestedAmount: applicant.loan_amount,
    probability: prediction.probability,
    risk_band: prediction.risk_band,
    top_features: prediction.top_features,
    createdAt: new Date().toISOString(),
  };
}

export const formatMoney = (n: number) => `$${n.toLocaleString("en-US")}`;

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const statusStyle: Record<ApplicantStatus, string> = {
  "Not Assessed": "bg-secondary text-muted-foreground border-border",
  Running: "bg-warning/10 text-warning border-warning/30",
  Completed: "bg-success/10 text-success border-success/30",
};

export const decisionStyle: Record<Decision, string> = {
  Approved: "bg-success/10 text-success border-success/30",
  Declined: "bg-destructive/10 text-destructive border-destructive/30",
  Referred: "bg-warning/10 text-warning border-warning/30",
};
