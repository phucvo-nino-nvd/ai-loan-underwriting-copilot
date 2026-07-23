"use client";

import { useState, useEffect } from "react";
import { formatMoney, type Applicant, type AssessmentRecord } from "@/lib/underwriting";
import type { Prediction } from "@/lib/api";

const bands: { name: Prediction["risk_band"]; color: string }[] = [
  { name: "LOW", color: "bg-success" },
  { name: "MEDIUM", color: "bg-chart-3" },
  { name: "HIGH", color: "bg-chart-4" },
  { name: "VERY HIGH", color: "bg-destructive" },
];

export function RiskDistribution({
  assessments,
  applicants,
}: {
  assessments: AssessmentRecord[];
  applicants: Applicant[];
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const exposure = applicants.reduce((acc, a) => acc + a.loan_amount, 0);

  return (
    <div className="bg-card/40 border border-border/60 p-5 h-[380px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground">Risk Distribution</h3>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-1">Completed assessments by risk band</p>
      </div>

      <div className="space-y-5">
        {bands.map((band, index) => {
          const count = assessments.filter((a) => a.risk_band === band.name).length;
          const share = assessments.length ? (count / assessments.length) * 100 : 0;

          return (
            <div key={band.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{band.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{count}</span>
                  <span className="text-sm font-semibold text-foreground">{share.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${band.color} rounded-full transition-all duration-1000 ease-out`}
                  style={{
                    width: isLoaded ? `${share}%` : "0%",
                    transitionDelay: `${index * 150}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total requested exposure */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Requested Exposure</span>
          <span className="text-xl font-bold text-foreground">{formatMoney(exposure)}</span>
        </div>
      </div>
    </div>
  );
}
