"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { OverviewSection } from "@/components/dashboard/sections/overview";
import { ApplicantsSection } from "@/components/dashboard/sections/applicants";
import { HistorySection } from "@/components/dashboard/sections/history";
import { AssistantSection } from "@/components/dashboard/sections/assistant";
import { SettingsSection } from "@/components/dashboard/sections/settings";
import {
  applicants as seedApplicants,
  scoreApplicant,
  seedAssessments,
  type AssessmentRecord,
  type Decision,
} from "@/lib/underwriting";

export type Section = "overview" | "applicants" | "history" | "assistant" | "settings";

/** How long a simulated model run takes before the applicant flips to Completed. */
const RUN_MS = 2200;

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user && !user.unsafeMetadata?.hasOnboarded) {
      router.replace("/onboarding");
    }
  }, [isLoaded, user, router]);

  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightApplicantId, setHighlightApplicantId] = useState<string | null>(null);

  const [applicants, setApplicants] = useState(seedApplicants);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(seedAssessments);
  const [openAssessment, setOpenAssessment] = useState<string | null>(null);

  // Assessments are only ever created here, driven from the Applicants page.
  function runAssessment(ids: string[]) {
    const targets = applicants.filter((a) => ids.includes(a.id) && a.status !== "Running");
    if (targets.length === 0) return;

    const running = new Set(targets.map((a) => a.id));
    setApplicants((prev) => prev.map((a) => (running.has(a.id) ? { ...a, status: "Running" } : a)));

    setTimeout(() => {
      setAssessments((prev) => [...targets.map(scoreApplicant), ...prev]);
      setApplicants((prev) => prev.map((a) => (running.has(a.id) ? { ...a, status: "Completed" } : a)));
    }, RUN_MS);
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
