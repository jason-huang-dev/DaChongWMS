export type AppLocale = "en" | "zh-CN";
export type AppThemeMode = "light" | "dark";

const storageKey = "dachongwms.ui-preferences";

interface StoredUiPreferences {
  locale?: string;
  themeMode?: string;
}

export interface UiPreferencesSnapshot {
  locale: AppLocale;
  themeMode: AppThemeMode;
}

const supportedLocales = new Set<AppLocale>(["en", "zh-CN"]);
const supportedThemeModes = new Set<AppThemeMode>(["light", "dark"]);

function isBrowserEnvironment() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeLocale(value?: string | null): AppLocale | null {
  if (!value) {
    return null;
  }

  if (supportedLocales.has(value as AppLocale)) {
    return value as AppLocale;
  }

  if (value.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  if (value.toLowerCase().startsWith("en")) {
    return "en";
  }

  return null;
}

function normalizeThemeMode(value?: string | null): AppThemeMode | null {
  if (!value) {
    return null;
  }
  return supportedThemeModes.has(value as AppThemeMode) ? (value as AppThemeMode) : null;
}

function getSystemLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return normalizeLocale(navigator.language) ?? "en";
}

function getSystemThemeMode(): AppThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPreferences(): StoredUiPreferences | null {
  if (!isBrowserEnvironment()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as StoredUiPreferences;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getUiPreferencesSnapshot(): UiPreferencesSnapshot {
  const stored = getStoredPreferences();

  return {
    locale: normalizeLocale(stored?.locale) ?? getSystemLocale(),
    themeMode: normalizeThemeMode(stored?.themeMode) ?? getSystemThemeMode(),
  };
}

export function saveUiPreferencesSnapshot(snapshot: UiPreferencesSnapshot) {
  if (!isBrowserEnvironment()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

export function getPreferredAppLocale(): AppLocale {
  return getUiPreferencesSnapshot().locale;
}

export function getPreferredThemeMode(): AppThemeMode {
  return getUiPreferencesSnapshot().themeMode;
}
