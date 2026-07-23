"use client";

import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import { RiskDistribution } from "@/components/dashboard/charts/pipeline-overview";
import { RecentDeals } from "@/components/dashboard/recent-deals";
import { TopPerformers } from "@/components/dashboard/top-performers";
import type { Applicant, AssessmentRecord } from "@/lib/underwriting";
import { ClipboardCheck, AlertTriangle, Activity, CheckCircle2 } from "lucide-react";

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function OverviewSection({
  assessments,
  applicants,
  onOpenAssessment,
}: {
  assessments: AssessmentRecord[];
  applicants: Applicant[];
  onOpenAssessment: (assessmentId: string) => void;
}) {
  const today = assessments.filter((a) => isToday(a.createdAt)).length;
  const highRisk = assessments.filter((a) => a.risk_band === "HIGH" || a.risk_band === "VERY HIGH").length;
  const avgPd = assessments.length
    ? (assessments.reduce((acc, a) => acc + a.probability, 0) / assessments.length) * 100
    : 0;
  const decided = assessments.filter((a) => a.decision);
  const approvalRate = decided.length
    ? (decided.filter((a) => a.decision === "Approved").length / decided.length) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Assessments"
          value={String(today)}
          change={`${assessments.length} total`}
          changeType="neutral"
          icon={ClipboardCheck}
          delay={0}
        />
        <MetricCard
          title="High Risk Applications"
          value={String(highRisk)}
          change={assessments.length ? `${((highRisk / assessments.length) * 100).toFixed(0)}% of book` : "—"}
          changeType={highRisk > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          delay={1}
        />
        <MetricCard
          title="Average Probability of Default"
          value={`${avgPd.toFixed(2)}%`}
          change="appetite 4.00%"
          changeType={avgPd <= 4 ? "positive" : "negative"}
          icon={Activity}
          delay={2}
        />
        <MetricCard
          title="Approval Rate"
          value={decided.length ? `${approvalRate.toFixed(0)}%` : "—"}
          change={`${decided.length} decided`}
          changeType="neutral"
          icon={CheckCircle2}
          delay={3}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart assessments={assessments} />
        </div>
        <RiskDistribution assessments={assessments} applicants={applicants} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentDeals assessments={assessments} onOpen={onOpenAssessment} />
        <TopPerformers />
      </div>
    </div>
  );
}
