import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { brandColors } from "@/app/brand";
import type { WorkspaceTabPreferenceRecord } from "@/shared/types/domain";

interface WorkspaceTabsBarProps {
  activePath: string;
  isClosingTab?: boolean;
  onActivate: (tabId: number, routePath: string) => void | Promise<void>;
  onClose: (tabId: number, routePath: string) => void | Promise<void>;
  tabs: WorkspaceTabPreferenceRecord[];
}

export function WorkspaceTabsBar({ activePath, isClosingTab = false, onActivate, onClose, tabs }: WorkspaceTabsBarProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
      {tabs.map((tab) => {
        const isActive = activePath === tab.route_path;
        return (
          <Stack
            alignItems="center"
            component="button"
            direction="row"
            key={tab.id}
            onClick={() => onActivate(tab.id, tab.route_path)}
            spacing={0.75}
            sx={{
              backgroundColor: isActive ? alpha(brandColors.gold, 0.18) : alpha(brandColors.surface, 0.78),
              border: `1px solid ${isActive ? alpha(brandColors.goldDark, 0.22) : alpha(brandColors.divider, 0.9)}`,
              borderRadius: 999,
              color: brandColors.ink,
              cursor: "pointer",
              flex: "0 0 auto",
              minWidth: 0,
              px: 1.5,
              py: 0.75,
            }}
          >
            {tab.is_pinned ? <PushPinRoundedIcon sx={{ fontSize: 15 }} /> : null}
            <Typography noWrap sx={{ fontSize: 12, fontWeight: isActive ? 700 : 600, maxWidth: 180 }}>
              {tab.title}
            </Typography>
            {tab.route_path !== "/dashboard" ? (
              <IconButton
                disabled={isClosingTab}
                onClick={(event) => {
                  event.stopPropagation();
                  void onClose(tab.id, tab.route_path);
                }}
                size="small"
                sx={{ p: 0.25 }}
              >
                <CloseRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            ) : null}
          </Stack>
        );
      })}
      {tabs.length === 0 ? (
        <Box sx={{ px: 1.5, py: 0.75 }}>
          <Typography color="text.secondary" variant="caption">
            Open routes are kept here for quick return.
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
