"use client";

import { useEffect, useState } from "react";
import { cn, matchPrefix } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AiAssistant } from "@/components/dashboard/ai-assistant";
import { bandStyle } from "@/lib/api";
import {
  decisionStyle,
  formatMoney,
  formatTime,
  statusStyle,
  type Applicant,
  type ApplicantStatus,
  type AssessmentRecord,
} from "@/lib/underwriting";
import {
  Users,
  Search,
  SearchX,
  Filter,
  DollarSign,
  Landmark,
  Play,
  Loader2,
  ChevronDown,
  MessageSquare,
  ArrowUpRight,
  X,
} from "lucide-react";

const statuses: ApplicantStatus[] = ["Not Assessed", "Running", "Completed"];

const pdLabel = (a: AssessmentRecord) => `${(a.probability * 100).toFixed(2)}%`;

export function ApplicantsSection({
  applicants,
  assessments,
  onRunAssessment,
  onOpenAssessment,
  searchQuery,
  onSearchChange,
  highlightApplicantId,
  onClearHighlight,
}: {
  applicants: Applicant[];
  assessments: AssessmentRecord[];
  onRunAssessment: (ids: string[]) => void;
  onOpenAssessment: (assessmentId: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  highlightApplicantId?: string | null;
  onClearHighlight?: () => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ApplicantStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [review, setReview] = useState<string[] | null>(null);

  const query = searchQuery ?? "";
  const setQuery = onSearchChange ?? (() => {});

  useEffect(() => {
    if (highlightApplicantId) {
      setExpanded(highlightApplicantId);
      onClearHighlight?.();
    }
  }, [highlightApplicantId]);

  const filtered = applicants.filter((a) => {
    const matchesSearch = !query.trim() || matchPrefix(query.trim(), a.name, a.id);
    return matchesSearch && (!selectedStatus || a.status === selectedStatus);
  });

  // Assessments arrive newest-first, so the first hit is the latest run for that applicant.
  const historyFor = (id: string) => assessments.filter((a) => a.applicantId === id);
  const latestFor = (id: string) => historyFor(id)[0];

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function run(ids: string[]) {
    onRunAssessment(ids);
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
  }

  const totalExposure = applicants.reduce((acc, a) => acc + a.loan_amount, 0);
  const pending = applicants.filter((a) => a.status === "Not Assessed").length;
  const running = applicants.filter((a) => a.status === "Running").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Applicants", value: applicants.length.toString(), icon: Users, color: "text-foreground" },
          { label: "Requested Exposure", value: `$${(totalExposure / 1000000).toFixed(2)}M`, icon: DollarSign, color: "text-accent" },
          { label: "Awaiting Assessment", value: pending.toString(), icon: Landmark, color: "text-chart-3" },
          { label: "Assessments Running", value: running.toString(), icon: Loader2, color: "text-chart-1" },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="group relative bg-card/40 border border-border/60 p-4 hover:border-accent/40 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl lg:text-3xl font-bold mt-1.5 tracking-tight ${stat.color}`}>{stat.value}</p>
              </div>
              <div className="w-9 h-9 bg-secondary flex items-center justify-center group-hover:bg-accent/10 transition-colors duration-300">
                <stat.icon className={`w-4 h-4 ${stat.color} group-hover:text-accent transition-colors duration-300`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: search, status filter, batch actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search applicants..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 w-full sm:w-[280px] bg-secondary border-border focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {statuses.map((status) => (
              <Button
                key={status}
                variant={selectedStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
                className={selectedStatus === status ? "bg-accent text-accent-foreground" : ""}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap lg:ml-auto">
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
          <Button variant="outline" size="sm" disabled={selected.length === 0} onClick={() => setReview(selected)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Review in Chat ({selected.length})
          </Button>
        </div>
        <div className="lg:mr-6 shrink-0">
          <Button
            onClick={() => run(selected)}
            disabled={selected.length === 0}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Assessment ({selected.length})
          </Button>
        </div>
      </div>

      {/* Review mini-card for the selected applicants */}
      {review && (
        <ReviewCard
          ids={review}
          applicants={applicants}
          latestFor={latestFor}
          onOpenAssessment={onOpenAssessment}
          onClose={() => setReview(null)}
        />
      )}

      {/* Applicant list */}
      <div className="space-y-3">
        {filtered.map((applicant, index) => {
          const isRunning = applicant.status === "Running";
          const isSelected = selected.includes(applicant.id);
          const isOpen = expanded === applicant.id;
          const history = historyFor(applicant.id);
          const latest = history[0];

          const decisionInfo = (() => {
            if (isRunning) return { label: "Running", style: statusStyle.Running, icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" /> };
            if (!latest) return { label: "Not Assessed", style: statusStyle["Not Assessed"], icon: null };
            if (latest.decision) return { label: latest.decision, style: decisionStyle[latest.decision], icon: null };
            return { label: "Pending Decision", style: statusStyle.Completed, icon: null };
          })();

          return (
            <div
              key={applicant.id}
              className={cn(
                "bg-card/40 border transition-all duration-300 group animate-in fade-in slide-in-from-bottom-2 overflow-hidden py-0 gap-0",
                isSelected ? "border-accent/60" : "border-border/60 hover:border-accent/40"
              )}
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
            >
              {/* Row */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : applicant.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpanded(isOpen ? null : applicant.id);
                  }
                }}
                className="flex md:grid md:grid-cols-[1.25rem_2.5rem_11rem_repeat(4,minmax(0,1fr))_8rem_10rem_1rem] items-center gap-4 p-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
              >
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(applicant.id)}
                    aria-label={`Select ${applicant.name}`}
                    className="size-[18px] border-muted-foreground/60 bg-secondary data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-foreground"
                  />
                </div>

                <Avatar className="w-10 h-10 bg-secondary shrink-0">
                  <AvatarFallback className="bg-secondary text-foreground text-sm font-semibold">
                    {applicant.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 md:flex-initial">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
                    {applicant.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{applicant.id}</p>
                </div>

                {[
                  { label: "Loan", value: formatMoney(applicant.loan_amount) },
                  { label: "Income", value: formatMoney(applicant.income) },
                  { label: "Employment", value: applicant.employment },
                  { label: "Latest PD", value: latest ? pdLabel(latest) : "—", band: latest?.risk_band },
                ].map((cell) => (
                  <div key={cell.label} className="hidden md:block min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {cell.label}
                    </p>
                    <p
                      className={cn(
                        "text-sm mt-0.5 truncate tabular-nums",
                        cell.band ? bandStyle[cell.band].color : "text-foreground"
                      )}
                    >
                      {cell.value}
                    </p>
                  </div>
                ))}

                <Badge className={`${decisionInfo.style} border shrink-0 justify-center md:w-full`}>
                    {decisionInfo.icon}
                    {decisionInfo.label}
                  </Badge>

                <div onClick={(e) => e.stopPropagation()} className="shrink-0 md:w-full">
                  <Button
                    size="sm"
                    onClick={() => run([applicant.id])}
                    disabled={isRunning}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Assessing…
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                        {latest ? "Re-run" : "Run Assessment"}
                      </>
                    )}
                  </Button>
                </div>

                <ChevronDown
                  className={cn(
                    "w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180"
                  )}
                />
              </div>

              {/* Detail */}
              {isOpen && (
                <div className="border-t border-border bg-secondary/20 p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                    {[
                      { label: "Loan Amount", value: formatMoney(applicant.loan_amount) },
                      { label: "Annual Income", value: formatMoney(applicant.income) },
                      { label: "Employment", value: applicant.employment },
                      { label: "Loan / Income", value: `${(applicant.loan_amount / applicant.income).toFixed(1)}×` },
                      { label: "Assessments", value: String(history.length) },
                    ].map((field) => (
                      <div key={field.label}>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          {field.label}
                        </p>
                        <p className="text-sm text-foreground mt-1.5 tabular-nums">{field.value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Assessment history</p>
                    {history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No assessments yet — run one to score this application.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => onOpenAssessment(a.id)}
                            className="w-full flex items-center justify-between gap-3 p-3 bg-card border border-border hover:border-accent/50 transition-colors duration-200 text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs text-accent shrink-0">{a.id}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(a.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-semibold text-foreground tabular-nums">{pdLabel(a)}</span>
                              <span
                                className={cn(
                                  "px-2 py-1 text-xs font-medium whitespace-nowrap",
                                  bandStyle[a.risk_band].bg,
                                  bandStyle[a.risk_band].color
                                )}
                              >
                                {a.risk_band}
                              </span>
                              {a.decision && (
                                <span
                                  className={cn(
                                    "px-2 py-1 text-xs font-medium border whitespace-nowrap",
                                    decisionStyle[a.decision]
                                  )}
                                >
                                  {a.decision}
                                </span>
                              )}
                              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center text-center px-6 py-16 border border-dashed border-border/40 bg-card/20">
          <div className="w-11 h-11 bg-secondary flex items-center justify-center">
            <SearchX className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No applicants match this view</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Adjust the search term or clear the status filter to see the full book.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setSelectedStatus(null);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact multi-applicant review: the selected book at a glance, plus a chat scoped to it. */
function ReviewCard({
  ids,
  applicants,
  latestFor,
  onOpenAssessment,
  onClose,
}: {
  ids: string[];
  applicants: Applicant[];
  latestFor: (applicantId: string) => AssessmentRecord | undefined;
  onOpenAssessment: (assessmentId: string) => void;
  onClose: () => void;
}) {
  const rows = ids
    .map((id) => ({ applicant: applicants.find((a) => a.id === id)!, latest: latestFor(id) }))
    .filter((r) => r.applicant);

  const scored = rows.filter((r) => r.latest).sort((a, b) => b.latest!.probability - a.latest!.probability);
  const unscored = rows.filter((r) => !r.latest);
  const line = (r: (typeof rows)[number]) =>
    r.latest
      ? `${r.applicant.name} (${r.applicant.id}) — PD ${pdLabel(r.latest)} ${r.latest.risk_band}, ${(
          r.applicant.loan_amount / r.applicant.income
        ).toFixed(1)}× income, ${r.applicant.employment}`
      : `${r.applicant.name} (${r.applicant.id}) — not assessed, ${(
          r.applicant.loan_amount / r.applicant.income
        ).toFixed(1)}× income, ${r.applicant.employment}`;

  return (
    <div className="bg-card/40 border border-border/60 p-4 sm:p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 pb-4 mb-5 border-b border-border">
        <div className="w-9 h-9 bg-secondary flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground tracking-tight">Review — {rows.length} applicants</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {scored.length} scored • {unscored.length} awaiting assessment
          </p>
        </div>
              <button
                    onClick={onClose}
                    aria-label="Close review"
                    className="w-8 h-8 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 mb-5">
        {rows.map(({ applicant, latest }) => (
          <div
            key={applicant.id}
            className="flex items-center justify-between gap-3 p-3 bg-secondary/40 border border-border"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{applicant.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{applicant.id}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-muted-foreground tabular-nums">{formatMoney(applicant.loan_amount)}</span>
              {latest ? (
                <>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{pdLabel(latest)}</span>
                  <span
                    className={cn(
                      "px-2 py-1 text-xs font-medium whitespace-nowrap",
                      bandStyle[latest.risk_band].bg,
                      bandStyle[latest.risk_band].color
                    )}
                  >
                    {latest.risk_band}
                  </span>
                  <button
                    onClick={() => onOpenAssessment(latest.id)}
                    className="text-xs font-medium text-accent hover:text-accent/80 flex items-center gap-1"
                  >
                    Open
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground border border-border">
                  Not Assessed
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <AiAssistant
        greeting={`Reviewing ${rows.length} applicant${rows.length === 1 ? "" : "s"}. Ask me to compare them, rank the risk, or check them against policy.`}
        context={`Applicants under review:\n${rows.map(line).join("\n")}\n\n---\n`}
        suggestions={[
          "Which of these is riskiest?",
          "Compare their affordability",
          "Which need manual referral?",
          "Draft a summary for the credit committee",
        ]}
      />
    </div>
  );
}
