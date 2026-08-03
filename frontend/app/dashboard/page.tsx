"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { OverviewSection } from "@/components/dashboard/sections/overview";
import { ApplicantsSection } from "@/components/dashboard/sections/applicants";
import { HistorySection } from "@/components/dashboard/sections/history";
import { AssistantSection } from "@/components/dashboard/sections/assistant";
import { SettingsSection } from "@/components/dashboard/sections/settings";
import { useApi } from "@/lib/api";
import {
  assessmentFromPrediction,
  type Applicant,
  type AssessmentRecord,
  type Decision,
} from "@/lib/underwriting";

export type Section = "overview" | "applicants" | "history" | "assistant" | "settings";

export default function Dashboard() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const router = useRouter();
  const api = useApi();

  useEffect(() => {
    if (authLoaded && !isSignedIn) {
      router.replace("/login");
    }
  }, [authLoaded, isSignedIn, router]);

  useEffect(() => {
    if (userLoaded && isSignedIn && user && !user.unsafeMetadata?.hasOnboarded) {
      router.replace("/onboarding");
    }
  }, [userLoaded, isSignedIn, user, router]);

  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightApplicantId, setHighlightApplicantId] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [openAssessment, setOpenAssessment] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoaded || !userLoaded || !isSignedIn || !user?.unsafeMetadata?.hasOnboarded) return;

    let cancelled = false;

    async function loadData() {
      try {
        const [savedAssessments, poolApplications] = await Promise.all([
          api.getHistory(),
          api.getApplications()
        ]);
        if (cancelled) return;

        setAssessments(savedAssessments);
        setApplicants(poolApplications);
        setDataError(null);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Unable to load data";
        setDataError(message);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [api, authLoaded, isSignedIn, userLoaded, user?.unsafeMetadata?.hasOnboarded]);

  async function runAssessment(ids: string[]) {
    const targets = applicants.filter((a) => ids.includes(a.id) && a.status !== "Running");
    if (targets.length === 0) return;

    const running = new Set(targets.map((a) => a.id));
    setApplicants((prev) => prev.map((a) => (running.has(a.id) ? { ...a, status: "Running" } : a)));

    try {
      const predictions = await Promise.all(
        targets.map(async (applicant) => ({ applicant, prediction: await api.predict(applicant.caseId) }))
      );
      const newRecords = await Promise.all(
        predictions.map(async ({ applicant, prediction }) => {
          const saved = await api.saveHistory({
            applicant: {
              name: applicant.name,
              income: applicant.income,
              employment: applicant.employment,
            },
            case_id: applicant.caseId,
            requested_amount: applicant.loan_amount,
            probability: prediction.probability,
            risk_band: prediction.risk_band,
            top_features: prediction.top_features,
          });
          return assessmentFromPrediction(prediction, applicant, saved);
        })
      );
      setAssessments((prev) => [...newRecords, ...prev]);
      setApplicants((prev) => prev.map((a) => (running.has(a.id) ? { ...a, status: "Completed" } : a)));
    } catch (e) {
      setApplicants((prev) => prev.map((a) => (running.has(a.id) ? { ...a, status: "Not Assessed" } : a)));
      const message = e instanceof Error ? e.message : "Unable to run prediction";
      toast.error("Prediction failed", { description: message });
    }
  }

  function openInWorkspace(assessmentId: string) {
    setOpenAssessment(assessmentId);
    setActiveSection("history");
  }

  function openApplicantProfile(id: string) {
    setHighlightApplicantId(id);
    setActiveSection("applicants");
  }

  function decide(assessmentId: string, decision: Decision) {
    setAssessments((prev) => prev.map((a) => (a.id === assessmentId ? { ...a, decision } : a)));
    api
      .saveDecision({ assessment_id: assessmentId, decision: decision.toLowerCase() })
      .catch((e) => console.error("Failed to save decision", e));
  }

  const renderSection = () => {
    switch (activeSection) {
      case "applicants":
        return (
          <ApplicantsSection
            applicants={applicants}
            assessments={assessments}
            onRunAssessment={runAssessment}
            onOpenAssessment={openInWorkspace}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            highlightApplicantId={highlightApplicantId}
            onClearHighlight={() => setHighlightApplicantId(null)}
          />
        );
      case "history":
        return (
          <HistorySection
            assessments={assessments}
            applicants={applicants}
            openId={openAssessment}
            onOpen={setOpenAssessment}
            onDecide={decide}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        );
      case "assistant":
        return <AssistantSection assessments={assessments} applicants={applicants} />;
      case "settings":
        return (
          <SettingsSection
            sidebarCollapsed={sidebarCollapsed}
            onSidebarCollapsedChange={setSidebarCollapsed}
          />
        );
      default:
        return (
          <OverviewSection
            assessments={assessments}
            applicants={applicants}
            onOpenAssessment={openInWorkspace}
          />
        );
    }
  };

  if (!authLoaded || !userLoaded) {
    return null;
  }

  if (!isSignedIn || !user?.unsafeMetadata?.hasOnboarded) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Grid overlay */}
      <div className="dashboard-grid-bg fixed inset-0 opacity-[0.06] pointer-events-none" aria-hidden="true" />
      {/* Noise overlay */}
      <div className="noise-overlay opacity-[0.015]" aria-hidden="true" />
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section);
          setSearchQuery("");
          setMobileNavOpen(false);
        }}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out ml-0 ${
          sidebarCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"
        }`}
      >
        <Header activeSection={activeSection} onMenuClick={() => setMobileNavOpen(true)} searchQuery={searchQuery} onSearchChange={setSearchQuery} applicants={applicants} assessments={assessments} onOpenApplicant={openApplicantProfile} onOpenAssessment={openInWorkspace} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {dataError && (
            <div className="mb-4 flex items-center justify-between gap-3 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <span>Unable to load backend data: {dataError}</span>
              <button type="button" onClick={() => setDataError(null)} className="font-medium hover:opacity-80">
                Dismiss
              </button>
            </div>
          )}
          <div
            key={activeSection}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}
