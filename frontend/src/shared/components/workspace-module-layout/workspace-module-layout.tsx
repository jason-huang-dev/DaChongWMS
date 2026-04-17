import type { ReactNode } from "react";

import { Box, Stack } from "@mui/material";

import {
  WorkspaceIconNav,
  workspaceIconNavCompactWidth,
  workspaceIconNavHiddenWidth,
  type WorkspaceIconNavItem,
  type WorkspaceIconNavMode,
} from "@/shared/components/workspace-icon-nav";

interface WorkspaceModuleLayoutProps {
  ariaLabel: string;
  children: ReactNode;
  hideLabel: string;
  isSaving?: boolean;
  items: WorkspaceIconNavItem[];
  mode: WorkspaceIconNavMode;
  navigationId: string;
  onHide: () => void;
  onShow: () => void;
  showLabel: string;
}

export function WorkspaceModuleLayout({
  ariaLabel,
  children,
  hideLabel,
  isSaving = false,
  items,
  mode,
  navigationId,
  onHide,
  onShow,
  showLabel,
}: WorkspaceModuleLayoutProps) {
  return (
    <Stack spacing={2.5} sx={{ height: "100%", minHeight: 0 }}>
      <Box
        sx={{
          alignItems: "stretch",
          display: "grid",
          flex: "1 1 auto",
          gap: 3,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md:
              mode === "hidden"
                ? `${workspaceIconNavHiddenWidth}px minmax(0, 1fr)`
                : `${workspaceIconNavCompactWidth}px minmax(0, 1fr)`,
          },
          minHeight: 0,
        }}
      >
        <WorkspaceIconNav
          ariaLabel={ariaLabel}
          hideLabel={hideLabel}
          isSaving={isSaving}
          items={items}
          mode={mode}
          navigationId={navigationId}
          onHide={onHide}
          onShow={onShow}
          showLabel={showLabel}
        />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {children}
        </Box>
      </Box>
    </Stack>
  );
}
