export const STORAGE_KEY = "aluci_settings";

export interface AppSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    timezone: string;
    darkMode: boolean;
    compactView: boolean;
    avatarUrl: string;
  };
  aiConfig: {
    preferredModel: string;
    temperature: number;
    maxTokens: number;
  };
}

export function defaultSettings(userName?: string, userEmail?: string): AppSettings {
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
      temperature: 0.7,
      maxTokens: 2048,
    },
  };
}

/** Stored settings merged over the defaults, so a field added later is never missing. */
export function loadSettings(userName?: string, userEmail?: string): AppSettings {
  const base = defaultSettings(userName, userEmail);
  if (typeof window === "undefined") return base;

  let stored: Partial<AppSettings>;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return base;
  }

  return {
    profile: { ...base.profile, ...stored.profile },
    aiConfig: { ...base.aiConfig, ...stored.aiConfig },
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

/** Merge a partial patch into what is stored — for callers that own a single field. */
export function patchSettings(patch: { [K in keyof AppSettings]?: Partial<AppSettings[K]> }) {
  const current = loadSettings();
  saveSettings({
    profile: { ...current.profile, ...patch.profile },
    aiConfig: { ...current.aiConfig, ...patch.aiConfig },
  });
}
