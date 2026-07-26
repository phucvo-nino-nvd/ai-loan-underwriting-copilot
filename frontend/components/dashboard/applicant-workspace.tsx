"use client";

import { cn } from "@/lib/utils";
import { AiAssistant } from "@/components/dashboard/ai-assistant";
import { bandStyle, type Feature } from "@/lib/api";
import {
  decisionStyle,
  formatMoney,
  formatTime,
  policies,
  type Applicant,
  type AssessmentRecord,
  type Decision,
} from "@/lib/underwriting";
import {
  Activity,
  BookText,
  Gavel,
  MessageSquare,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";

function formatValue(value: Feature["value"]) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  return String(value);
}

function Section({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card/40 border border-border/60 p-4 sm:p-5 transition-colors duration-300 hover:border-border/60">
      <div className="flex items-center gap-3 pb-4 mb-5 border-b border-border/60">
        <div className="w-9 h-9 bg-secondary/60 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ApplicantWorkspace({
  assessment,
  applicant,
  onClose,
  onDecide,
}: {
  assessment: AssessmentRecord;
  applicant?: Applicant;
  onClose: () => void;
  onDecide: (assessmentId: string, decision: Decision) => void;
}) {
  const band = bandStyle[assessment.risk_band];
  const maxShap = Math.max(...assessment.top_features.map((f) => Math.abs(f.shap_value)), 1e-9);
  const relevant = policies.filter((p) => {
    if (p.id === "CRD-019") return assessment.risk_band === "HIGH" || assessment.risk_band === "VERY HIGH";
    if (p.id === "CRD-011") return applicant?.employment === "Self-employed" || applicant?.employment === "Contract";
    if (p.id === "CRD-004") return applicant ? applicant.loan_amount / applicant.income > 4 : false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">Assessment Workspace</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono text-xs text-accent">{assessment.id}</span> • {assessment.applicantName} • scored{" "}
            {formatTime(assessment.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close workspace"
          className="w-8 h-8 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Applicant Profile */}
      <Section icon={UserRound} title="Applicant Profile" subtitle="Application data submitted for underwriting">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            { label: "Applicant", value: assessment.applicantName },
            { label: "Applicant ID", value: assessment.applicantId },
            { label: "Loan Amount", value: applicant ? formatMoney(applicant.loan_amount) : "—" },
            { label: "Annual Income", value: applicant ? formatMoney(applicant.income) : "—" },
            { label: "Employment", value: applicant?.employment ?? "—" },
          ].map((field) => (
            <div key={field.label}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{field.label}</p>
              <p className="text-sm text-foreground mt-1.5">{field.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 2. Risk Summary */}
      <Section icon={ShieldAlert} title="Risk Summary" subtitle="Ensemble model output for this application">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-secondary/40 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Probability of Default</p>
            <p className="text-2xl font-bold text-foreground tracking-tight tabular mt-2">
              {(assessment.probability * 100).toFixed(2)}%
            </p>
          </div>
          <div className="p-4 bg-secondary/40 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Risk Band</p>
            <span className={cn("inline-block mt-2 px-2 py-1 text-sm font-medium", band.bg, band.color)}>
              {assessment.risk_band}
            </span>
          </div>
          <div className="p-4 bg-secondary/40 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Model</p>
            <p className="font-mono text-sm font-medium text-foreground mt-2">ensemble-5fold</p>
            <p className="text-xs text-muted-foreground mt-1">CatBoost .50 / LightGBM .35 / XGBoost .15</p>
          </div>
          <div className="p-4 bg-secondary/40 border border-border">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Decision</p>
            <p className="text-sm font-medium text-foreground mt-2">{assessment.decision ?? "Pending underwriter"}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatTime(assessment.createdAt)}</p>
          </div>
        </div>
      </Section>

      {/* 3. SHAP Explainability */}
      <Section
        icon={Activity}
        title="SHAP Explainability"
        subtitle="Feature contributions to the predicted PD (mean over 15 fold models)"
      >
        <div className="space-y-3">
          {assessment.top_features.map((f) => {
            const width = `${(Math.abs(f.shap_value) / maxShap) * 100}%`;
            const increases = f.shap_value > 0;

            return (
              <div key={f.feature} className="flex items-center gap-3 sm:gap-4">
                <span className="w-32 sm:w-56 shrink-0 text-sm text-foreground truncate" title={f.feature}>
                  {f.feature}
                </span>
                <div className="flex-1 flex items-center min-w-0">
                  <div className="flex-1 flex justify-end">
                    <div
                      className={cn("h-2.5 rounded-l-full transition-all duration-700", !increases && "bg-success")}
                      style={{ width: increases ? 0 : width }}
                    />
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex-1">
                    <div
                      className={cn("h-2.5 rounded-r-full transition-all duration-700", increases && "bg-destructive")}
                      style={{ width: increases ? width : 0 }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    "w-14 sm:w-16 shrink-0 text-right text-xs sm:text-sm font-medium tabular-nums",
                    increases ? "text-destructive" : "text-success"
                  )}
                >
                  {increases ? "+" : "−"}
                  {Math.abs(f.shap_value).toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-5">
          Red increases the predicted probability of default, green reduces it.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-6 pt-5 border-t border-border">
          {assessment.top_features.map((f) => (
            <div key={f.feature}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate" title={f.feature}>
                {f.feature}
              </p>
              <p className="text-sm text-foreground mt-1.5 tabular-nums">{formatValue(f.value)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Related Policies */}
      <Section icon={BookText} title="Related Policies" subtitle="Credit policy clauses triggered by this application">
        <div className="space-y-3">
          {relevant.map((policy) => (
            <div
              key={policy.id}
              className="p-4 bg-secondary/40 border border-border hover:border-accent/40 transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-accent">{policy.id}</span>
                <span className="text-sm font-medium text-foreground">{policy.title}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">{policy.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. AI Chat — scoped to this assessment */}
      <Section icon={MessageSquare} title="AI Assistant" subtitle={`Ask me to write a report, recommend a decision, or drill into the risk drivers and policy for ${assessment.id}`}>
        <AiAssistant
          greeting={`I've got the assessment for ${assessment.applicantName} (${assessment.id}). I can write an underwriting report, recommend a decision, or answer questions about the risk drivers and policy.`}
          context={
            `Assessment ${assessment.id} for ${assessment.applicantName} (${assessment.applicantId})\n` +
            `Default probability: ${(assessment.probability * 100).toFixed(2)}% (risk band: ${assessment.risk_band})\n\n` +
            `Strongest contributing factors:\n` +
            assessment.top_features
              .map((f) => `- ${f.feature} = ${f.value} | SHAP ${f.shap_value >= 0 ? "+" : ""}${f.shap_value.toFixed(4)}`)
              .join("\n") +
            "\n\n---\n"
          }
          suggestions={[
            "Write underwriting report",
            "Recommend decision",
            "Why is the PD this high?",
            "Which factors could be mitigated?",
          ]}
        />
      </Section>

      {/* 6. Credit Decision */}
      <Section icon={Gavel} title="Credit Decision" subtitle="The underwriter of record owns this decision (CRD-023)">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {(["Approved", "Declined", "Referred"] as const).map((decision) => (
            <button
              key={decision}
              onClick={() => {
                onDecide(assessment.id, decision);
                onClose();
              }}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium border transition-all duration-200",
                assessment.decision === decision
                  ? decisionStyle[decision]
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
              )}
            >
              {decision === "Approved" ? "Approve" : decision === "Declined" ? "Decline" : "Refer"}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          {assessment.decision
            ? `Recorded as ${assessment.decision} — visible in Assessment History.`
            : "No decision recorded yet."}
        </p>
      </Section>
    </div>
  );
}
