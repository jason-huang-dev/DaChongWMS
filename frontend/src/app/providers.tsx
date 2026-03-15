import type { PropsWithChildren } from "react";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";

import { TenantScopeProvider } from "@/app/scope-context";
import { AuthProvider } from "@/features/auth/controller/useAuthController";
import { queryClient } from "@/lib/query-client";
import { appTheme } from "@/app/theme";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TenantScopeProvider>{children}</TenantScopeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
