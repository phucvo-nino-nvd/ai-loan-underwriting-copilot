"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Eye,
  EyeOff,
  Cpu,
  Copy,
  AlertTriangle,
  Camera,
  Loader2,
  Upload,
  FileText,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  timezone: string;
  darkMode: boolean;
  compactView: boolean;
  avatarUrl: string;
}

interface AppSettings {
  profile: ProfileSettings;
  aiConfig: {
    preferredModel: string;
    nvidiaKey: string;
    temperature: number;
    maxTokens: number;
  };
  dataManagement: {
    retentionDays: number;
    autoExport: boolean;
    exportFormat: "csv" | "json";
  };
}

/* -------------------------------------------------------------------------- */
/*  Defaults & helpers                                                         */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "swin_settings";

function defaultSettings(userName?: string, userEmail?: string): AppSettings {
  return {
    profile: {
      firstName: userName?.split(" ")[0] ?? "",
      lastName: userName?.split(" ").slice(1).join(" ") ?? "",
      email: userEmail ?? "",
      role: "manager",
      timezone: "pst",
      darkMode: true,
      compactView: false,
      avatarUrl: "",
    },
    aiConfig: {
      preferredModel: "openai/gpt-oss-120b",
      nvidiaKey: "",
      temperature: 0.7,
      maxTokens: 2048,
    },
    dataManagement: {
      retentionDays: 90,
      autoExport: false,
      exportFormat: "csv",
    },
  };
}

function loadSettings(userName?: string, userEmail?: string): AppSettings {
  if (typeof window === "undefined") return defaultSettings(userName, userEmail);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppSettings;
      // Merge with defaults so new fields are never missing
      return {
        ...defaultSettings(userName, userEmail),
        ...parsed,
        profile: { ...defaultSettings(userName, userEmail).profile, ...parsed.profile },
        aiConfig: { ...defaultSettings(userName, userEmail).aiConfig, ...parsed.aiConfig },
        dataManagement: { ...defaultSettings(userName, userEmail).dataManagement, ...parsed.dataManagement },
      };
    }
  } catch {
    // corrupted data — reset
  }
  return defaultSettings(userName, userEmail);
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface SettingsSectionProps {
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function PolicyUploader() {
  const [documents, setDocuments] = useState<{ name: string; size: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rag/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
      }
    } catch {
      // backend offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/rag/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Upload failed");
      }

      toast.success(`"${file.name}" uploaded and ingested`);
      await fetchDocs();
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/rag/documents/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Delete failed");
      }

      toast.success(`"${name}" deleted`);
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
              key={doc.name}
              className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate">{doc.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({(doc.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(doc.name)}
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
  const router = useRouter();
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
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);

  // Persist on every change & notify sidebar
  useEffect(() => {
    saveSettings(settings);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
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
    (patch: Partial<ProfileSettings>) =>
      setSettings((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
    []
  );

  const updateAiConfig = useCallback(
    (patch: Partial<AppSettings["aiConfig"]>) =>
      setSettings((s) => ({ ...s, aiConfig: { ...s.aiConfig, ...patch } })),
    []
  );

  const updateDataManagement = useCallback(
    (patch: Partial<AppSettings["dataManagement"]>) =>
      setSettings((s) => ({
        ...s,
        dataManagement: { ...s.dataManagement, ...patch },
      })),
    []
  );

  /* ---------- actions ---------- */

  const handleUpdatePassword = () => {
    const current = (document.getElementById("currentPassword") as HTMLInputElement)
      ?.value;
    const newPw = (document.getElementById("newPassword") as HTMLInputElement)
      ?.value;
    const confirm = (
      document.getElementById("confirmPassword") as HTMLInputElement
    )?.value;

    if (!current || !newPw || !confirm) {
      toast.error("All password fields are required");
      return;
    }
    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPw !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    toast.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Updating password…",
        success: "Password updated successfully",
        error: "Password update failed",
      }
    );
  };

  const handleRevokeSession = () => {
    toast.success("Session revoked", {
      description: "The selected device has been signed out.",
    });
  };

  const handleExportData = (format: "csv" | "json") => {
    // In a real app this would call the backend to generate a download
    toast.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      {
        loading: `Generating ${format.toUpperCase()} export…`,
        success: `${format.toUpperCase()} export ready for download`,
        error: "Export failed",
      }
    );
  };

  const handleCopyApiKey = (key: string, label: string) => {
    navigator.clipboard.writeText(key).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error("Failed to copy")
    );
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
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    className="bg-secondary border-border focus:border-accent max-w-md"
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    className="bg-secondary border-border focus:border-accent max-w-md"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="bg-secondary border-border focus:border-accent max-w-md"
                    placeholder="Re-enter new password"
                  />
                </div>
                <Button variant="outline" onClick={handleUpdatePassword}>
                  Update Password
                </Button>
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
                <div className="flex items-center gap-3">
                  <Badge className="bg-accent/20 text-accent border-accent/30">Enabled</Badge>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Active Sessions</CardTitle>
              <CardDescription>Manage devices where you&apos;re signed in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { device: "MacBook Pro", location: "San Francisco, CA", current: true, time: "Now" },
                  { device: "iPhone 15", location: "San Francisco, CA", current: false, time: "2 hours ago" },
                  { device: "Chrome on Windows", location: "New York, NY", current: false, time: "1 day ago" },
                ].map((session) => (
                  <div
                    key={session.device}
                    className="flex items-center justify-between p-3 bg-secondary/30 border border-border animate-in fade-in slide-in-from-left-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {session.device}
                          {session.current && (
                            <Badge className="ml-2 bg-accent/20 text-accent border-accent/30 text-xs">
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.location} &bull; {session.time}
                        </p>
                      </div>
                    </div>
                    {!session.current && (
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
                              This will sign out {session.device} from {session.location}.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="gap-2">
                            <Button variant="outline" className="bg-secondary">Cancel</Button>
                            <Button variant="destructive" onClick={handleRevokeSession}>
                              Revoke
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                ))}
              </div>
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
                     <SelectItem value="openai/gpt-oss-120b">NVIDIA openai-oss-120b</SelectItem>
                     <SelectItem value="openai/chatgpt-oss-20b">GPT OSS 20B</SelectItem>
                     <SelectItem value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</SelectItem>
                   </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  First-choice model for policy queries and report generation.
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">API Keys</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    API keys are stored locally and never sent to our servers.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nvidiaKey">NVIDIA API Key</Label>
                  <div className="flex gap-2 max-w-md">
                    <div className="relative flex-1">
                      <Input
                        id="nvidiaKey"
                        type={showNvidiaKey ? "text" : "password"}
                        value={settings.aiConfig.nvidiaKey}
                        onChange={(e) => updateAiConfig({ nvidiaKey: e.target.value })}
                        placeholder="nvapi-…"
                        className="bg-secondary border-border focus:border-accent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNvidiaKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopyApiKey(settings.aiConfig.nvidiaKey, "NVIDIA API key")}
                      disabled={!settings.aiConfig.nvidiaKey}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
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
                <div className="p-4 border border-border bg-secondary/20 hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Assessments</p>
                        <p className="text-sm text-muted-foreground">All assessment records</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:ring-1 hover:ring-accent/50 dark:hover:text-foreground"
                      onClick={() => handleExportData("csv")}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:ring-1 hover:ring-accent/50 dark:hover:text-foreground"
                      onClick={() => handleExportData("json")}
                    >
                      Export JSON
                    </Button>
                  </div>
                </div>

                <div className="p-4 border border-border bg-secondary/20 hover:border-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/20 flex items-center justify-center">
                        <Download className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Applicants</p>
                        <p className="text-sm text-muted-foreground">Applicant pipeline data</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:ring-1 hover:ring-accent/50 dark:hover:text-foreground"
                      onClick={() => handleExportData("csv")}
                    >
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:ring-1 hover:ring-accent/50 dark:hover:text-foreground"
                      onClick={() => handleExportData("json")}
                    >
                      Export JSON
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-medium">Data Retention</CardTitle>
              <CardDescription>Configure how long assessment data is kept</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="retentionDays">Retention Period</Label>
                <Select
                  value={String(settings.dataManagement.retentionDays)}
                  onValueChange={(v) => updateDataManagement({ retentionDays: Number(v) })}
                >
                  <SelectTrigger className="bg-secondary border-border max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assessments older than this will be automatically archived.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">Delete All Data</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove all underwriting data from this workspace
                    </p>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete All
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Irreversible Action
                      </DialogTitle>
                      <DialogDescription>
                        This will permanently delete all applicants, assessments, and
                        policy data. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" className="bg-secondary">Cancel</Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          toast.success("All data has been deleted", {
                            description: "This is a simulated action. No real data was affected.",
                          });
                        }}
                      >
                        I understand, delete everything
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
