"use client";

import { cn } from "@/lib/utils";
import { bandStyle } from "@/lib/api";
import { decisionStyle, formatTime, type AssessmentRecord } from "@/lib/underwriting";
import { CheckCircle2, XCircle, Clock, FileSearch } from "lucide-react";

const decisionIcon = { Approved: CheckCircle2, Declined: XCircle, Referred: Clock };

export function RecentDeals({
  assessments,
  onOpen,
}: {
  assessments: AssessmentRecord[];
  onOpen: (assessmentId: string) => void;
}) {
  const recent = [...assessments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div className="bg-card/40 border border-border/60 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent Assessments</h3>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-1">Already generated — click one to open its workspace</p>
        </div>
      </div>

      <div className="space-y-3">
        {recent.map((assessment, index) => {
          const band = bandStyle[assessment.risk_band];
          const DecisionIcon = assessment.decision ? decisionIcon[assessment.decision] : null;

          return (
            <button
              key={assessment.id}
              onClick={() => onOpen(assessment.id)}
              className="group w-full flex items-center justify-between gap-3 p-3 text-left cursor-pointer hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-all duration-200 animate-in fade-in slide-in-from-left-2"
              style={{ animationDelay: `${(index + 3) * 100}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-secondary flex items-center justify-center text-sm font-semibold text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-all duration-200">
                  {assessment.applicantName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{assessment.applicantName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {assessment.id} • {formatTime(assessment.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {(assessment.probability * 100).toFixed(2)}%
                </span>
                <span className={cn("px-2 py-1 text-xs font-medium whitespace-nowrap", band.bg, band.color)}>
                  {assessment.risk_band}
                </span>
                {assessment.decision && DecisionIcon && (
                  <span
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 text-xs font-medium border",
                      decisionStyle[assessment.decision]
                    )}
                  >
                    <DecisionIcon className="w-3 h-3" />
                    {assessment.decision}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {recent.length === 0 && (
          <div className="flex flex-col items-center text-center px-6 py-10 border border-dashed border-border/40 bg-card/20">
            <div className="w-11 h-11 bg-secondary flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No assessments yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Run one from the Applicants page and it will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
