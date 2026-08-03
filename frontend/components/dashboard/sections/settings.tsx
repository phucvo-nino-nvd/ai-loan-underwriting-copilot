"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk, useSession } from "@clerk/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { formatTime } from "@/lib/underwriting";
import { loadSettings, saveSettings, STORAGE_KEY, type AppSettings } from "@/lib/settings";
import type { SessionWithActivitiesResource } from "@clerk/shared/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  User,
  Shield,
  Palette,
  Database,
  Globe,
  Key,
  Download,
  Trash2,
  Cpu,
  Camera,
  Loader2,
  Upload,
  FileText,
} from "lucide-react";

interface SettingsSectionProps {
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
}

/** Clerk puts the readable message in errors[0]; plain Errors only have .message. */
const clerkError = (err: any, fallback: string): string =>
  err?.errors?.[0]?.longMessage || err?.message || fallback;

function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]): string {
  const columns = Object.keys(rows[0]);
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}

function ActiveSessions() {
  const { user } = useUser();
  const { session } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setSessions(await user.getSessions());
    } catch (err) {
      toast.error(clerkError(err, "Could not load active sessions"));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const revoke = async (target: SessionWithActivitiesResource) => {
    try {
      await target.revoke();
      toast.success("Session revoked");
      await refresh();
    } catch (err) {
      toast.error(clerkError(err, "Could not revoke session"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading sessions…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const activity = s.latestActivity;
        const device = activity?.deviceType || activity?.browserName || "Unknown device";
        const location = [activity?.city, activity?.country].filter(Boolean).join(", ") || "Unknown location";
        const isCurrent = s.id === session?.id;

        return (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 bg-secondary/30 border border-border animate-in fade-in slide-in-from-left-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Globe className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {device}
                  {isCurrent && (
                    <Badge className="ml-2 bg-accent/20 text-accent border-accent/30 text-xs">Current</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {location} &bull; {formatTime(s.lastActiveAt.toISOString())}
                </p>
              </div>
            </div>
            {!isCurrent && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:text-destructive">
                    Revoke
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Revoke session?</DialogTitle>
                    <DialogDescription>
                      This will sign out {device} from {location}.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" className="bg-secondary">Cancel</Button>
                    <Button variant="destructive" onClick={() => revoke(s)}>
                      Revoke
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PolicyUploader() {
  const [documents, setDocuments] = useState<{ id: string; title: string; category?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const api = useApi();

  const fetchDocs = useCallback(async () => {
    try {
      setDocuments(await api.getPolicyDocuments());
    } catch (err: any) {
      toast.error("Could not load policy documents", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadPolicy(file);
      toast.success(`"${file.name}" uploaded and ingested`);
      await fetchDocs();
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/api/rag/documents/${encodeURIComponent(id)}`);
      toast.success("Document deleted");
      await fetchDocs();
    } catch (err: any) {
      toast.error("Delete failed", { description: err.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="relative hover:ring-1 hover:ring-accent/50"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {uploading ? "Ingesting…" : "Upload Policy File"}
          <input
            type="file"
            accept=".md"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleUpload}
            disabled={uploading}
          />
        </Button>
        <p className="text-sm text-muted-foreground">
          .md &mdash; files are chunked and embedded for RAG
        </p>
      </div>

      <div className="border border-border divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No policy documents uploaded yet.
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate">{doc.title}</span>
                {doc.category && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {doc.category}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function SettingsSection({
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: SettingsSectionProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { setTheme } = useTheme();
  const firstName = user?.firstName || (user?.unsafeMetadata as any)?.firstName || "";
  const lastName = user?.lastName || (user?.unsafeMetadata as any)?.lastName || "";
  const userName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
  const userEmail = user?.primaryEmailAddress?.emailAddress || undefined;
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((s) => s![0])
    .join("") || "U";

  const [settings, setSettings] = useState<AppSettings>(() =>
    loadSettings(userName, userEmail)
  );
  const [activeTab, setActiveTab] = useState("profile");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const api = useApi();

  // Persist on every change; saveSettings notifies the sidebar.
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Auto-delete account after re-authentication flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("delete_account") === "true" && user) {
      (async () => {
        try {
          await user.delete();
          localStorage.removeItem(STORAGE_KEY);
          toast.success("Account deleted successfully");
          window.location.href = "/";
        } catch (err: any) {
          toast.error(err?.errors?.[0]?.longMessage || err?.message || "Failed to delete account");
        }
      })();
    }
  }, [user]);

  /* ---------- helpers ---------- */

  const updateProfile = useCallback(
    (patch: Partial<AppSettings["profile"]>) =>
      setSettings((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
    []
  );

  const updateAiConfig = useCallback(
    (patch: Partial<AppSettings["aiConfig"]>) =>
      setSettings((s) => ({ ...s, aiConfig: { ...s.aiConfig, ...patch } })),
    []
  );

  /* ---------- actions ---------- */

  const handleUpdatePassword = async () => {
    const { current, next, confirm } = passwords;
    if (!current || !next || !confirm) return toast.error("All password fields are required");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("New passwords do not match");

    setChangingPassword(true);
    try {
      await user!.updatePassword({
        currentPassword: current,
        newPassword: next,
        signOutOfOtherSessions: true,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password updated", { description: "Your other devices have been signed out." });
    } catch (err) {
      toast.error("Password update failed", { description: clerkError(err, "Please try again.") });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportData = async (kind: "assessments" | "applicants", format: "csv" | "json") => {
    try {
      const rows: Record<string, unknown>[] =
        kind === "assessments"
          ? (await api.getHistory()).map((a) => ({
              id: a.id,
              case_id: a.caseId,
              applicant: a.applicantName,
              requested_amount: a.requestedAmount ?? "",
              probability: a.probability,
              risk_band: a.risk_band,
              decision: a.decision ?? "",
              created_at: a.createdAt,
            }))
          : (await api.getApplications()).map((a) => ({
              id: a.id,
              case_id: a.caseId,
              name: a.name,
              income: a.income,
              loan_amount: a.loan_amount,
              employment: a.employment,
              status: a.status,
            }));

      if (rows.length === 0) return toast.info(`No ${kind} to export yet`);

      download(
        `aluci-${kind}.${format}`,
        format === "csv" ? "text/csv" : "application/json",
        format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2),
      );
      toast.success(`Exported ${rows.length} ${kind} as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error("Export failed", { description: err.message });
    }
  };

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-1">
          Manage your account and workspace preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary border border-border p-1 flex-wrap rounded-none">
          <TabsTrigger value="profile" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="security" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="ai-config" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Cpu className="w-4 h-4 mr-2" />
            AI Config
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            <Database className="w-4 h-4 mr-2" />
            Data
          </TabsTrigger>
          <TabsTrigger value="policy" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            <FileText className="w-4 h-4 mr-2" />
            Policy
          </TabsTrigger>
        </TabsList>

        {/* ======================== PROFILE ======================== */}
        <TabsContent value="profile" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Personal Information</CardTitle>
              <CardDescription>Update your personal details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <label htmlFor="avatar-upload" className="cursor-pointer group relative">
                  <Avatar className="w-20 h-20 bg-secondary ring-2 ring-transparent group-hover:ring-accent/50 transition-all duration-200">
                    {settings.profile.avatarUrl ? (
                      <img
                        src={settings.profile.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-semibold">
                        {initials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        toast.error("File too large", { description: "Maximum size is 2MB." });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        updateProfile({ avatarUrl: dataUrl });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="dark:border-border"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                    >
                      {settings.profile.avatarUrl ? "Change Avatar" : "Upload Avatar"}
                    </Button>
                    {settings.profile.avatarUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => updateProfile({ avatarUrl: "" })}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP. Max 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={settings.profile.firstName}
                    onChange={(e) => updateProfile({ firstName: e.target.value })}
                    className="bg-secondary border-border focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={settings.profile.lastName}
                    onChange={(e) => updateProfile({ lastName: e.target.value })}
                    className="bg-secondary border-border focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.profile.email}
                    onChange={(e) => updateProfile({ email: e.target.value })}
                    className="bg-secondary border-border focus:border-accent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={settings.profile.role}
                    onValueChange={(v) => updateProfile({ role: v })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="manager">Underwriting Manager</SelectItem>
                      <SelectItem value="rep">Loan Officer</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.profile.timezone}
                  onValueChange={(v) => updateProfile({ timezone: v })}
                >
                  <SelectTrigger className="bg-secondary border-border w-full md:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                    <SelectItem value="mst">Mountain Time (MT)</SelectItem>
                    <SelectItem value="cst">Central Time (CT)</SelectItem>
                    <SelectItem value="est">Eastern Time (ET)</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Display Preferences</CardTitle>
              <CardDescription>Customize how data is displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                  </div>
                </div>
                <Switch
                  checked={settings.profile.darkMode}
                  onCheckedChange={(v) => {
                    updateProfile({ darkMode: v });
                    setTheme(v ? "dark" : "light");
                  }}
                  className="data-[state=unchecked]:border-border/40"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Compact View</p>
                    <p className="text-sm text-muted-foreground">Show more data in less space</p>
                  </div>
                </div>
                <Switch
                  checked={settings.profile.compactView}
                  onCheckedChange={(v) => {
                    updateProfile({ compactView: v });
                    onSidebarCollapsedChange(v);
                  }}
                  className="data-[state=unchecked]:border-border/40"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5 shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium text-destructive">Account Management</CardTitle>
              <CardDescription>Manage your session and account lifecycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Sign Out</p>
                  <p className="text-sm text-muted-foreground">Log out of your current session</p>
                </div>
                <Button variant="outline" onClick={async () => {
                  await signOut();
                  window.location.href = "/";
                }}>
                  Sign Out
                </Button>
              </div>
              <Separator className="bg-destructive/10" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all its data</p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Delete Account</Button>
                  </DialogTrigger>
                  <DialogContent className="border-border bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-destructive">Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. This will permanently delete your account, 
                        remove your profile from the system, and erase all related configurations.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                      <Button variant="outline" className="bg-secondary text-foreground">Cancel</Button>
                       <Button variant="destructive" onClick={async () => {
                         try {
                           if (user) {
                             await user.delete();
                             localStorage.removeItem(STORAGE_KEY);
                             toast.success("Account deleted successfully");
                             window.location.href = "/";
                           }
                         } catch (err: any) {
                           const code = err?.errors?.[0]?.code;
                           if (code === "requires_recent_authentication") {
                             toast.info("Need re-authentication. Signing out...");
                             setTimeout(() => {
                               signOut({ redirectUrl: `/sign-in?redirect_url=/settings&delete_account=true` });
                             }, 1500);
                           } else {
                             toast.error(err?.errors?.[0]?.longMessage || err?.message || "Failed to delete account");
                           }
                         }
                       }}>
                        Delete My Account
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ======================== NOTIFICATIONS ======================== */}


        {/* ======================== SECURITY ======================== */}
        <TabsContent value="security" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Password & Authentication</CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[
                  { id: "current" as const, label: "Current Password", placeholder: "Enter current password" },
                  { id: "next" as const, label: "New Password", placeholder: "At least 8 characters" },
                  { id: "confirm" as const, label: "Confirm New Password", placeholder: "Re-enter new password" },
                ].map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      type="password"
                      autoComplete={field.id === "current" ? "current-password" : "new-password"}
                      value={passwords[field.id]}
                      onChange={(e) => setPasswords((p) => ({ ...p, [field.id]: e.target.value }))}
                      className="bg-secondary border-border focus:border-accent max-w-md"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
                <Button variant="outline" onClick={handleUpdatePassword} disabled={changingPassword}>
                  {changingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
                <p className="text-xs text-muted-foreground">
                  Updating your password signs out every other device.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-secondary/50 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/20 flex items-center justify-center">
                    <Key className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app for 2FA codes
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    user?.twoFactorEnabled
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-secondary text-muted-foreground border-border"
                  }
                >
                  {user?.twoFactorEnabled ? "Enabled" : "Not enabled"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Active Sessions</CardTitle>
              <CardDescription>Manage devices where you&apos;re signed in</CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveSessions />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== AI CONFIG ======================== */}
        <TabsContent value="ai-config" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">AI Model Configuration</CardTitle>
              <CardDescription>Configure the AI models used for underwriting analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="preferredModel">Preferred Model</Label>
                <Select
                  value={settings.aiConfig.preferredModel}
                  onValueChange={(v) => updateAiConfig({ preferredModel: v })}
                >
                  <SelectTrigger className="bg-secondary border-border max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="openai/gpt-oss-120b">GPT-OSS 120B</SelectItem>
                     <SelectItem value="openai/gpt-oss-20b">GPT-OSS 20B</SelectItem>
                     <SelectItem value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</SelectItem>
                   </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  First-choice model for policy queries and report generation.
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="temperature"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.aiConfig.temperature}
                      onChange={(e) => updateAiConfig({ temperature: parseFloat(e.target.value) })}
                      className="flex-1 accent-accent h-2 rounded-full appearance-none bg-secondary cursor-pointer"
                    />
                    <span className="text-sm font-mono text-muted-foreground w-8 text-right">
                      {settings.aiConfig.temperature.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lower = more deterministic, Higher = more creative
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Output Tokens</Label>
                  <Select
                    value={String(settings.aiConfig.maxTokens)}
                    onValueChange={(v) => updateAiConfig({ maxTokens: Number(v) })}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="512">512</SelectItem>
                      <SelectItem value="1024">1,024</SelectItem>
                      <SelectItem value="2048">2,048</SelectItem>
                      <SelectItem value="4096">4,096</SelectItem>
                      <SelectItem value="8192">8,192</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Maximum tokens per response
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== DATA MANAGEMENT ======================== */}
        <TabsContent value="data" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Data Export</CardTitle>
              <CardDescription>Export underwriting data for external analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { kind: "assessments", title: "Assessments", blurb: "All assessment records" },
                  { kind: "applicants", title: "Applicants", blurb: "Applicant pipeline data" },
                ] as const).map((source) => (
                  <div
                    key={source.kind}
                    className="p-4 border border-border bg-secondary/20 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-accent/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{source.title}</p>
                        <p className="text-sm text-muted-foreground">{source.blurb}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["csv", "json"] as const).map((format) => (
                        <Button
                          key={format}
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:ring-1 hover:ring-accent/50 dark:hover:text-foreground"
                          onClick={() => handleExportData(source.kind, format)}
                        >
                          Export {format.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================== POLICY DOCUMENTS ======================== */}
        <TabsContent value="policy" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Policy Documents</CardTitle>
              <CardDescription>
                Upload credit policy files to enrich the AI assistant's knowledge base. Supported: Markdown (.md).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PolicyUploader />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
