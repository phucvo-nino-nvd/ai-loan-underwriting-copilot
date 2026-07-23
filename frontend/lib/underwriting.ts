/**
 * Mock underwriting domain — applicants, simulated scoring, assessment records.
 * ponytail: pure mock; swap `scoreApplicant` for `api.predict(caseId)` when the backend is wired.
 */
import type { Feature, Prediction } from "@/lib/api";

export type ApplicantStatus = "Not Assessed" | "Running" | "Completed";
export type Decision = "Approved" | "Declined" | "Referred";

export interface Applicant {
  id: string;
  name: string;
  income: number;
  loan_amount: number;
  employment: "Full-time" | "Part-time" | "Self-employed" | "Contract" | "Retired" | "Unemployed";
  status: ApplicantStatus;
}

export interface AssessmentRecord extends Pick<Prediction, "probability" | "risk_band" | "top_features"> {
  id: string;
  applicantId: string;
  applicantName: string;
  createdAt: string;
  decision?: Decision;
}

export const applicants: Applicant[] = [
  { id: "APP-1001", name: "Amara Okafor", income: 92000, loan_amount: 240000, employment: "Full-time", status: "Not Assessed" },
  { id: "APP-1002", name: "Daniel Whitfield", income: 61000, loan_amount: 310000, employment: "Self-employed", status: "Not Assessed" },
  { id: "APP-1003", name: "Priya Raman", income: 148000, loan_amount: 420000, employment: "Full-time", status: "Completed" },
  { id: "APP-1004", name: "Tomás Herrera", income: 47000, loan_amount: 195000, employment: "Contract", status: "Not Assessed" },
  { id: "APP-1005", name: "Grace Lindqvist", income: 205000, loan_amount: 380000, employment: "Full-time", status: "Completed" },
  { id: "APP-1006", name: "Jamal Rickards", income: 38000, loan_amount: 210000, employment: "Part-time", status: "Not Assessed" },
  { id: "APP-1007", name: "Wei Zhang", income: 118000, loan_amount: 265000, employment: "Full-time", status: "Not Assessed" },
  { id: "APP-1008", name: "Rebecca Nolan", income: 54000, loan_amount: 330000, employment: "Unemployed", status: "Completed" },
  { id: "APP-1009", name: "Hassan Baig", income: 87000, loan_amount: 175000, employment: "Self-employed", status: "Not Assessed" },
  { id: "APP-1010", name: "Elise Moreau", income: 132000, loan_amount: 290000, employment: "Full-time", status: "Not Assessed" },
  { id: "APP-1011", name: "Owen Fitzgerald", income: 44000, loan_amount: 120000, employment: "Retired", status: "Not Assessed" },
  { id: "APP-1012", name: "Sofia Almeida", income: 76000, loan_amount: 355000, employment: "Contract", status: "Not Assessed" },
];

const employmentRisk: Record<Applicant["employment"], number> = {
  "Full-time": 0,
  "Part-time": 0.06,
  "Self-employed": 0.05,
  Contract: 0.04,
  Retired: 0.03,
  Unemployed: 0.22,
};

/** Stable pseudo-random jitter so the same applicant always scores the same. */
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function riskBand(pd: number): Prediction["risk_band"] {
  if (pd < 0.05) return "LOW";
  if (pd < 0.15) return "MEDIUM";
  if (pd < 0.35) return "HIGH";
  return "VERY HIGH";
}

function features(a: Applicant, dti: number): Feature[] {
  const jitter = (n: number) => ((hash(a.id + n) % 100) / 100 - 0.5) * 0.04;
  const raw: Feature[] = [
    { feature: "debt_to_income_ratio", value: Number(dti.toFixed(2)), shap_value: (dti - 2.5) * 0.06 + jitter(1), importance: 0 },
    { feature: "employment_status", value: a.employment, shap_value: employmentRisk[a.employment] - 0.02 + jitter(2), importance: 0 },
    { feature: "annual_income", value: a.income, shap_value: (85000 - a.income) / 900000 + jitter(3), importance: 0 },
    { feature: "loan_amount", value: a.loan_amount, shap_value: (a.loan_amount - 250000) / 3000000 + jitter(4), importance: 0 },
    { feature: "bureau_score", value: 520 + (hash(a.id) % 320), shap_value: jitter(5) * 2, importance: 0 },
    { feature: "months_at_address", value: 6 + (hash(a.id + "addr") % 120), shap_value: jitter(6), importance: 0 },
    { feature: "prior_delinquencies", value: hash(a.id + "del") % 3, shap_value: (hash(a.id + "del") % 3) * 0.025 + jitter(7), importance: 0 },
    { feature: "revolving_utilisation", value: Number(((hash(a.id + "util") % 95) / 100).toFixed(2)), shap_value: jitter(8) * 1.5, importance: 0 },
  ];
  return raw
    .map((f) => ({ ...f, importance: Math.abs(f.shap_value) }))
    .sort((x, y) => y.importance - x.importance);
}

/** Simulated model call: PD driven by affordability, employment and a stable per-applicant jitter. */
export function scoreApplicant(a: Applicant): AssessmentRecord {
  const dti = a.loan_amount / a.income;
  const pd = Math.min(
    0.97,
    Math.max(0.004, 0.012 + dti * 0.022 + employmentRisk[a.employment] + ((hash(a.id) % 40) - 20) / 2000)
  );

  return {
    id: `ASMT-${hash(a.id + Date.now()) % 9000 + 1000}`,
    applicantId: a.id,
    applicantName: a.name,
    probability: pd,
    risk_band: riskBand(pd),
    top_features: features(a, dti),
    createdAt: new Date().toISOString(),
  };
}

/** Assessments that already existed when the underwriter signed in. */
export const seedAssessments: AssessmentRecord[] = applicants
  .filter((a) => a.status === "Completed")
  .map((a, i) => ({
    ...scoreApplicant(a),
    id: `ASMT-${2040 + i}`,
    // Spread across the last 3 months so the PD trend chart has multiple points.
    createdAt: new Date(
      Math.floor(Date.now() / 3600_000) * 3600_000 - (i + 1) * 30 * 24 * 3600_000
    ).toISOString(),
  }));

export const policies = [
  {
    id: "CRD-004",
    title: "Debt-to-Income Threshold",
    body: "Unsecured exposure above 4.0× gross annual income requires senior credit sign-off regardless of model output.",
  },
  {
    id: "CRD-011",
    title: "Employment Verification",
    body: "Self-employed and contract applicants must evidence 24 months of trading history before approval.",
  },
  {
    id: "CRD-019",
    title: "High Risk Band Referral",
    body: "Applications scored HIGH or VERY HIGH must be referred to manual underwriting; auto-decline is not permitted.",
  },
  {
    id: "CRD-023",
    title: "Model Advisory Status",
    body: "The PD model is decision-support only. The underwriter of record owns the final credit decision.",
  },
];

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
