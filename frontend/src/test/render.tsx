import type { PropsWithChildren, ReactElement } from "react";
import { useMemo } from "react";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { TenantScopeProvider } from "@/app/scope-context";
import { createAppTheme } from "@/app/theme";
import { UiPreferencesProvider, useUiPreferences } from "@/app/ui-preferences";
import { appRoutes } from "@/app/routes";
import { AuthProvider } from "@/features/auth/controller/useAuthController";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function TestThemeProvider({ children }: PropsWithChildren) {
  const { locale, themeMode } = useUiPreferences();
  const theme = useMemo(() => createAppTheme(themeMode, locale), [locale, themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function BaseProviders({ children, includeAuth = false }: PropsWithChildren<{ includeAuth?: boolean }>) {
  const content = includeAuth ? (
    <AuthProvider>
      <TenantScopeProvider>{children}</TenantScopeProvider>
    </AuthProvider>
  ) : children;
  return (
    <UiPreferencesProvider>
      <TestThemeProvider>{content}</TestThemeProvider>
    </UiPreferencesProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: { includeAuth?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <BaseProviders includeAuth={options.includeAuth}>{ui}</BaseProviders>
    </QueryClientProvider>,
  );

  return { queryClient, ...rendered };
}

export function renderWithRouter(initialEntries: string[]) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(appRoutes, { initialEntries });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <BaseProviders includeAuth>
        <RouterProvider router={router} />
      </BaseProviders>
    </QueryClientProvider>,
  );

  return { queryClient, router, ...rendered };
}
