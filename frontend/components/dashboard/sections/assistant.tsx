"use client";

import { ChatPane } from "@/components/dashboard/chat-pane";
import { type Applicant, type AssessmentRecord } from "@/lib/underwriting";
import { MessageSquare } from "lucide-react";

export function AssistantSection({
  assessments,
  applicants,
}: {
  assessments: AssessmentRecord[];
  applicants: Applicant[];
}) {
  const ranked = [...assessments].sort((a, b) => b.probability - a.probability);
  const avgPd = assessments.length
    ? (assessments.reduce((acc, a) => acc + a.probability, 0) / assessments.length) * 100
    : 0;

  const pdLine = (a: AssessmentRecord) =>
    `${a.applicantName} (${a.applicantId}) — ${(a.probability * 100).toFixed(2)}% ${a.risk_band}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Portfolio Assistant</h2>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-1">
          Asks across the whole book — applicants, assessments and credit policy. For questions about a single
          application, open its workspace from Assessment History.
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card/40 border border-border/60 p-4 sm:p-5">
        <ChatPane
          header={
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-border/60">
              <div className="w-9 h-9 bg-secondary flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground tracking-tight">AI Assistant</h3>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-0.5">
                  {applicants.length} applicants • {assessments.length} assessments • avg PD {avgPd.toFixed(2)}%
                </p>
              </div>
            </div>
          }
          greeting="I can see the whole portfolio — applicants, completed assessments and the credit policy library. What would you like to know?"
          context={
            `Portfolio snapshot\n` +
            `Applicants: ${applicants.length} (${applicants.filter((a) => a.status === "Not Assessed").length} not yet assessed)\n` +
            `Assessments: ${assessments.length}, average PD ${avgPd.toFixed(2)}%\n\n` +
            ranked.map(pdLine).join("\n") +
            "\n\n---\n"
          }
          suggestions={[
            "Who has the highest PD?",
            "Summarize recent assessments",
            "Explain the DTI policy",
            "How many are unassessed?",
          ]}
        />
      </div>
    </div>
  );
}
