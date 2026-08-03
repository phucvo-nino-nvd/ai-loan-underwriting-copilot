"use client";

import { Fragment, useEffect, useState } from "react";
import { cn, matchPrefix } from "@/lib/utils";
import { bandStyle, type Prediction } from "@/lib/api";
import {
  decisionStyle,
  formatTime,
  type Applicant,
  type AssessmentRecord,
  type Decision,
} from "@/lib/underwriting";
import { ApplicantWorkspace } from "@/components/dashboard/applicant-workspace";
import { Search, SearchX, FileSearch, CheckCircle2, ChevronDown, ArrowUpRight } from "lucide-react";

const bands: Prediction["risk_band"][] = ["LOW", "MEDIUM", "HIGH", "VERY HIGH"];

const pd = (a: AssessmentRecord) => `${(a.probability * 100).toFixed(2)}%`;

/** One row per applicant, newest run first; the runs themselves live inside the row. */
function groupByApplicant(assessments: AssessmentRecord[]) {
  const groups = new Map<string, AssessmentRecord[]>();
  for (const a of assessments) groups.set(a.applicantId, [...(groups.get(a.applicantId) ?? []), a]);
  return [...groups.values()]
    .map((runs) => [...runs].sort((x, y) => y.createdAt.localeCompare(x.createdAt)))
    .sort((x, y) => y[0].createdAt.localeCompare(x[0].createdAt));
}

export function HistorySection({
  assessments,
  applicants,
  openId,
  onOpen,
  onDecide,
  searchQuery,
  onSearchChange,
}: {
  assessments: AssessmentRecord[];
  applicants: Applicant[];
  openId: string | null;
  onOpen: (id: string | null) => void;
  onDecide: (assessmentId: string, decision: Decision) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}) {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = searchQuery ?? "";
  const setQuery = onSearchChange ?? (() => {});

  const open = assessments.find((a) => a.id === openId);

  // Arriving from the dashboard or an applicant card: reveal the run that was opened.
  useEffect(() => {
    if (open) setExpanded(open.applicantId);
  }, [open?.applicantId]);

  const groups = groupByApplicant(assessments).filter((runs) => {
    const [latest] = runs;
    const matchesSearch =
      !query.trim() ||
      matchPrefix(query.trim(), latest.applicantName, latest.applicantId, String(latest.caseId)) ||
      runs.some((r) => matchPrefix(query.trim(), r.id));
    return matchesSearch && (selectedFilter === "all" || latest.risk_band === selectedFilter);
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          One row per applicant — open a row to see every assessment run for that ID. New assessments are
          started from the Applicants page.
        </p>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 lg:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search assessment or applicant..."
              aria-label="Search assessments"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-72 h-9 pl-9 pr-4 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {["all", ...bands].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  selectedFilter === filter
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {filter === "all" ? "All" : filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card/40 border border-border/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Case ID", "Applicant", "Latest PD", "Risk Band", "Status", "Runs", "Last Assessed", ""].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16">
                    <div className="flex flex-col items-center text-center px-6">
                      <div className="w-11 h-11 bg-secondary flex items-center justify-center">
                        <SearchX className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-foreground">No assessments match this view</p>
                      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        {assessments.length === 0
                          ? "Select applicants and run an assessment to populate this history."
                          : "Try a different search term, or clear the risk band filter."}
                      </p>
                      {assessments.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("");
                            setSelectedFilter("all");
                          }}
                          className="mt-4 px-3 py-1.5 bg-secondary text-xs font-medium text-foreground hover:bg-secondary/70 transition-colors duration-200"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {groups.map((runs, index) => {
                const [latest] = runs;
                const band = bandStyle[latest.risk_band];
                const isExpanded = expanded === latest.applicantId;

                return (
                  <Fragment key={latest.applicantId}>
                    <tr
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => {
                        const nextExpanded = isExpanded ? null : latest.applicantId;
                        setExpanded(nextExpanded);
                        if (!nextExpanded && open?.applicantId === latest.applicantId) {
                          onOpen(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          const nextExpanded = isExpanded ? null : latest.applicantId;
                          setExpanded(nextExpanded);
                          if (!nextExpanded && open?.applicantId === latest.applicantId) {
                            onOpen(null);
                          }
                        }
                      }}
                      className={cn(
                        "group border-b border-border transition-colors duration-150 cursor-pointer animate-in fade-in slide-in-from-left-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                        isExpanded ? "bg-accent/10" : "hover:bg-secondary/40"
                      )}
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
                    >
                      <td
                        className={cn(
                          "py-4 px-4 border-l-4 transition-colors duration-150",
                          isExpanded ? "border-l-accent" : "border-l-transparent"
                        )}
                      >
                        <span className={cn("font-mono text-xs", isExpanded ? "text-accent" : "text-muted-foreground")}>
                          {latest.caseId}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-foreground">{latest.applicantName}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-foreground tabular-nums">{pd(latest)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn("px-2 py-1 text-xs font-medium whitespace-nowrap", band.bg, band.color)}>
                          {latest.risk_band}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {latest.decision ? (
                          <span
                            className={cn(
                              "px-2 py-1 text-xs font-medium border whitespace-nowrap",
                              decisionStyle[latest.decision]
                            )}
                          >
                            {latest.decision}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground tabular-nums">{runs.length}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatTime(latest.createdAt)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform duration-300",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-border bg-accent/5">
                        <td colSpan={8} className="p-4">
                          <p className="text-sm font-medium text-foreground mb-3">
                            {runs.length} assessment{runs.length === 1 ? "" : "s"} for case {latest.caseId}
                          </p>
                          <div className="space-y-2">
                            {runs.map((run) => (
                              <button
                                key={run.id}
                                onClick={() => onOpen(run.id)}
                                className={cn(
                                  "w-full flex items-center justify-between gap-3 p-3 text-left transition-colors duration-200",
                                  run.id === openId
                                    ? "bg-accent/20 ring-1 ring-accent/50"
                                    : "bg-accent/10 hover:bg-accent/15"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono text-xs text-accent shrink-0">{run.id}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatTime(run.createdAt)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-semibold text-foreground tabular-nums">{pd(run)}</span>
                                  <span
                                    className={cn(
                                      "px-2 py-1 text-xs font-medium whitespace-nowrap",
                                      bandStyle[run.risk_band].bg,
                                      bandStyle[run.risk_band].color
                                    )}
                                  >
                                    {run.risk_band}
                                  </span>
                                  {run.decision && (
                                    <span
                                      className={cn(
                                        "px-2 py-1 text-xs font-medium border whitespace-nowrap",
                                        decisionStyle[run.decision]
                                      )}
                                    >
                                      {run.decision}
                                    </span>
                                  )}
                                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-secondary/30">
          <span className="text-sm text-muted-foreground">
            {groups.length} applicant{groups.length === 1 ? "" : "s"} • {assessments.length} assessments
          </span>
        </div>
      </div>

      {/* Assessment workspace for the selected run */}
      {open ? (
        <ApplicantWorkspace
          key={open.id}
          assessment={open}
          applicant={applicants.find((a) => a.caseId === open.caseId)}
          onClose={() => onOpen(null)}
          onDecide={onDecide}
        />
      ) : (
          <div className="flex flex-col items-center text-center px-6 py-12 border border-dashed border-border/40 bg-card/20">
                      <div className="w-11 h-11 bg-secondary flex items-center justify-center">
                        <FileSearch className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No assessment open</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Open an applicant row above, then pick one of its runs to load the workspace — profile, risk summary,
            SHAP, AI report, policies and the credit decision.
          </p>
        </div>
      )}
    </div>
  );
}
