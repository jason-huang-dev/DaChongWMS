import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";

import { TenantScopeProvider } from "@/app/scope-context";
import { createAppTheme } from "@/app/theme";
import { UiPreferencesProvider, useUiPreferences } from "@/app/ui-preferences";
import { AuthProvider } from "@/features/auth/controller/useAuthController";
import { queryClient } from "@/lib/query-client";

function AppThemeProvider({ children }: PropsWithChildren) {
  const { locale, themeMode } = useUiPreferences();
  const theme = useMemo(() => createAppTheme(themeMode, locale), [locale, themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <UiPreferencesProvider>
      <AppThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TenantScopeProvider>{children}</TenantScopeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </UiPreferencesProvider>
  );
}
