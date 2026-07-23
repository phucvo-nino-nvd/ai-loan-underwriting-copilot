"use client";

import { useRef, useEffect, useMemo } from "react";
import { cn, matchPrefix } from "@/lib/utils";
import type { Section } from "@/app/dashboard/page";
import type { Applicant, AssessmentRecord } from "@/lib/underwriting";
import { Search, Calendar, Menu, ArrowRight } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  activeSection: Section;
  onMenuClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  applicants: Applicant[];
  assessments: AssessmentRecord[];
  onOpenApplicant: (id: string) => void;
  onOpenAssessment: (id: string) => void;
}

interface SearchHit {
  type: "applicant" | "assessment";
  id: string;
  label: string;
  sublabel: string;
}

const sectionTitles: Record<Section, string> = {
  overview: "Portfolio Overview",
  applicants: "Applicants",
  history: "Assessment History",
  assistant: "AI Assistant",
  settings: "Settings",
};

export function Header({ activeSection, onMenuClick, searchQuery, onSearchChange, applicants, assessments, onOpenApplicant, onOpenAssessment }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as SearchHit[];

    const results: SearchHit[] = [];

    for (const a of applicants) {
      if (matchPrefix(q, a.name, a.id)) {
        results.push({ type: "applicant", id: a.id, label: a.name, sublabel: a.id });
      }
    }

    for (const asm of assessments) {
      if (matchPrefix(q, asm.applicantName, asm.applicantId, asm.id)) {
        results.push({ type: "assessment", id: asm.id, label: asm.applicantName, sublabel: `${asm.id} — ${asm.risk_band}` });
      }
    }

    return results;
  }, [searchQuery, applicants, assessments]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(hit: SearchHit) {
    setShowDropdown(false);
    inputRef.current?.blur();
    if (hit.type === "applicant") {
      onOpenApplicant(hit.id);
    } else {
      onOpenAssessment(hit.id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" && hits.length > 0) {
      if (hits.length === 1) {
        handleSelect(hits[0]);
      } else {
        setShowDropdown(false);
        inputRef.current?.blur();
        const first = hits[0];
        if (first.type === "applicant") {
          onOpenApplicant(first.id);
        } else {
          onOpenAssessment(first.id);
        }
      }
    }
  }

  const dropdownOpen = showDropdown && searchQuery.trim().length > 0 && hits.length > 0;

  return (
    <header className="h-16 border-b border-border bg-background sticky top-0 z-20 flex items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="md:hidden w-9 h-9 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm uppercase tracking-widest font-bold text-foreground truncate">
          {sectionTitles[activeSection]}
        </h1>
        <div className="hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Last 30 days</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="relative hidden sm:flex items-center">
          <div
            className={cn(
              "relative transition-all duration-300",
              searchFocused ? "w-64" : "w-48"
            )}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search applicants, assessments..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                setSearchFocused(true);
                setShowDropdown(true);
              }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleKeyDown}
              className="w-full h-9 pl-9 pr-4 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
            />
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-0 mt-1.5 w-80 bg-card border border-border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50"
            >
              <div className="max-h-80 overflow-y-auto py-2">
                {/* Applicant hits */}
                {hits.filter((h) => h.type === "applicant").length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Applicants
                    </div>
                    {hits.filter((h) => h.type === "applicant").map((hit) => (
                      <button
                        key={hit.id}
                        onClick={() => handleSelect(hit)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/60 transition-colors duration-150 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{hit.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">{hit.sublabel}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Assessment hits */}
                {hits.filter((h) => h.type === "assessment").length > 0 && (
                  <div className={cn(hits.filter((h) => h.type === "applicant").length > 0 && "border-t border-border mt-1 pt-1")}>
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Assessments
                    </div>
                    {hits.filter((h) => h.type === "assessment").map((hit) => (
                      <button
                        key={hit.id}
                        onClick={() => handleSelect(hit)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/60 transition-colors duration-150 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{hit.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">{hit.sublabel}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border px-3 py-2 bg-secondary/30">
                <p className="text-xs text-muted-foreground">
                   <kbd className="px-1 py-0.5 bg-secondary border border-border font-mono text-[11px]">Enter</kbd> filter section · <kbd className="px-1 py-0.5 bg-secondary border border-border font-mono text-[11px]">Esc</kbd> close
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
