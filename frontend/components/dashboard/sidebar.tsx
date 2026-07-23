"use client";

import React, { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { Section } from "@/app/dashboard/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BitmapChevron } from "@/components/landing/bitmap-chevron";
import {
  LayoutDashboard,
  Users,
  History,
  Sparkles,
  Settings,
  X,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "applicants", label: "Applicants", icon: Users },
  { id: "history", label: "Assessment History", icon: History },
  { id: "assistant", label: "AI Assistant", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings },
];

function getCustomAvatar(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("swin_settings");
    if (!raw) return "";
    const data = JSON.parse(raw);
    return data?.profile?.avatarUrl || "";
  } catch {
    return "";
  }
}

function UserBadge({ collapsed, onMobileClose, onSectionChange }: { collapsed: boolean; onMobileClose: () => void; onSectionChange: (section: Section) => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const firstName = user?.firstName || (user?.unsafeMetadata as any)?.firstName || "";
  const lastName = user?.lastName || (user?.unsafeMetadata as any)?.lastName || "";
  
  const initials =
    [firstName, lastName].filter(Boolean).map((s) => s![0]).join("") || "U";
  
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const displayName = fullName || user?.primaryEmailAddress?.emailAddress || "User";

  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const avatarSrc = customAvatar || "";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setCustomAvatar(getCustomAvatar());
    const handler = () => setCustomAvatar(getCustomAvatar());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className="hidden md:flex w-full items-center gap-3 px-2 py-1.5 transition-all duration-200 hover:bg-sidebar-accent/50 rounded cursor-pointer text-left"
      >
        <Avatar className="w-9 h-9 shrink-0 ring-2 ring-sidebar-border">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div
          className={cn(
            "flex flex-col min-w-0 whitespace-nowrap transition-all duration-300 overflow-hidden",
            collapsed ? "opacity-0 w-0" : "opacity-100"
          )}
        >
          <span className="text-xs font-bold text-sidebar-foreground truncate">
            {displayName}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
            {user?.primaryEmailAddress?.emailAddress || ""}
          </span>
        </div>
      </button>

      {dropdownOpen && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-1.5 min-w-[180px] bg-card border border-border overflow-hidden z-50",
            collapsed && "left-1/2 -translate-x-1/2"
          )}
        >
          <button
            onClick={() => {
              onSectionChange("settings");
              setDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-secondary/60 transition-colors duration-150 text-left"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span>Settings</span>
          </button>
          <div className="border-t border-border" />
          <button
            onClick={() => {
              setDropdownOpen(false);
              signOut({ redirectUrl: "/" });
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-secondary/60 transition-colors duration-150 text-left"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      <button
        onClick={onMobileClose}
        className="md:hidden w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200"
      >
        <X className="w-5 h-5" />
        <span>Close</span>
      </button>
    </div>
  );
}

export function Sidebar({
  activeSection,
  onSectionChange,
  collapsed,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={() => onMobileOpenChange(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out flex flex-col",
        collapsed ? "w-[72px]" : "w-[260px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0 text-sidebar-foreground">
            <BitmapChevron className="w-6 h-6" />
          </div>
          <div
            className={cn(
              "flex flex-col whitespace-nowrap transition-all duration-300 overflow-hidden",
              collapsed ? "opacity-0 w-0" : "opacity-100 w-auto"
            )}
          >
            <span className="text-xs font-bold leading-tight text-sidebar-foreground">
              AI Loan Underwriting
            </span>
            <span className="text-[10px] uppercase tracking-widest leading-tight text-muted-foreground">
              Copilot
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-xs uppercase tracking-widest font-bold transition-all duration-200 group relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
            >
              {/* Active indicator */}
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-accent transition-all duration-300",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200",
                  isActive ? "text-accent" : "group-hover:scale-110"
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* User avatar */}
      <div className="p-3 border-t border-sidebar-border">
        <UserBadge collapsed={collapsed} onMobileClose={() => onMobileOpenChange(false)} onSectionChange={onSectionChange} />
      </div>
    </aside>
    </>
  );
}
