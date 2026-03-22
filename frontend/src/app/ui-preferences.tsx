import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { resolveTranslation, translateText, type TranslationKey } from "@/app/i18n";
import {
  getUiPreferencesSnapshot,
  saveUiPreferencesSnapshot,
  type AppLocale,
  type AppThemeMode,
} from "@/app/ui-preferences-storage";

interface UiPreferencesContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  themeMode: AppThemeMode;
  setThemeMode: (themeMode: AppThemeMode) => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: PropsWithChildren) {
  const initialSnapshot = useMemo(() => getUiPreferencesSnapshot(), []);
  const [locale, setLocale] = useState<AppLocale>(initialSnapshot.locale);
  const [themeMode, setThemeMode] = useState<AppThemeMode>(initialSnapshot.themeMode);

  useEffect(() => {
    saveUiPreferencesSnapshot({ locale, themeMode });
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dataset.theme = themeMode;
      document.documentElement.style.colorScheme = themeMode;
    }
  }, [locale, themeMode]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      themeMode,
      setThemeMode,
    }),
    [locale, themeMode],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider.");
  }
  return context;
}

export function useI18n() {
  const { locale } = useUiPreferences();

  return useMemo(
    () => ({
      locale,
      t: (key: TranslationKey, params?: Record<string, string | number | null | undefined>) =>
        resolveTranslation(locale, key, params),
      translateText: (value: string) => translateText(locale, value),
    }),
    [locale],
  );
}
