import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import type { WorkspaceTabPreferenceRecord } from "@/shared/types/domain";

interface WorkspaceTabsBarProps {
  activePath: string;
  compact?: boolean;
  isClosingTab?: boolean;
  onActivate: (tabId: number, routePath: string) => void | Promise<void>;
  onClose: (tabId: number, routePath: string) => void | Promise<void>;
  tabs: WorkspaceTabPreferenceRecord[];
}

export function WorkspaceTabsBar({ activePath, compact = true, isClosingTab = false, onActivate, onClose, tabs }: WorkspaceTabsBarProps) {
  const theme = useTheme();
  const { t, translate, msg } = useI18n();
  const isDark = theme.palette.mode === "dark";

  return (
    <Stack
      aria-label="Open workspaces"
      direction="row"
      role="tablist"
      spacing={1}
      sx={{ overflowX: "auto", pb: 0.25 }}
    >
      {tabs.map((tab) => {
        const isActive = activePath === tab.route_path;
        return (
          <Stack
            alignItems="center"
            aria-label={t(tab.title)}
            aria-selected={isActive}
            component="button"
            direction="row"
            key={tab.id}
            onClick={() => onActivate(tab.id, tab.route_path)}
            role="tab"
            spacing={0.75}
            sx={{
              backgroundColor: isActive
                ? alpha(brandColors.accent, isDark ? 0.16 : 0.1)
                : alpha(theme.palette.background.paper, isDark ? 0.72 : 0.78),
              border: `1px solid ${
                isActive
                  ? alpha(brandColors.accentStrong, isDark ? 0.34 : 0.22)
                  : alpha(theme.palette.divider, 0.9)
              }`,
              borderRadius: 999,
              boxShadow: isActive ? `inset 0 0 0 1px ${alpha(brandColors.accent, 0.2)}` : "none",
              color: theme.palette.text.primary,
              cursor: "pointer",
              flex: "0 0 auto",
              minWidth: 0,
              position: "relative",
              px: compact ? 0.475 : 0.625,
              py: compact ? 0.175 : 0.25,
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&::before": {
                backgroundColor: isActive ? brandColors.accent : brandStatusColors.info.light,
                borderRadius: 999,
                content: "\"\"",
                height: 6,
                left: 10,
                opacity: tab.is_active ? 1 : 0.45,
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                width: 6,
              },
              "&:hover": {
                boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
                transform: "translateY(-1px)",
              },
              "&:focus-visible": {
                boxShadow: `0 0 0 3px ${alpha(brandColors.accent, isDark ? 0.24 : 0.16)}`,
              },
            }}
          >
            {tab.is_pinned ? (
              <PushPinRoundedIcon sx={{ color: brandColors.accentStrong, fontSize: compact ? 13 : 15, ml: 1 }} />
            ) : (
              <Box sx={{ ml: 1 }} />
            )}
            <Typography
              noWrap
              sx={{
                fontSize: compact ? 9 : 11,
                fontWeight: isActive ? 700 : 600,
                maxWidth: compact ? 150 : 180,
              }}
            >
              {t(tab.title)}
            </Typography>
            {tab.route_path !== "/dashboard" ? (
              <IconButton
                disabled={isClosingTab}
                onClick={(event) => {
                  event.stopPropagation();
                  void onClose(tab.id, tab.route_path);
                }}
                size="small"
                sx={{
                  p: 0.25,
                  color: alpha(theme.palette.text.primary, isDark ? 0.68 : 0.54),
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
                  },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: compact ? 13 : 15 }} />
              </IconButton>
            ) : null}
          </Stack>
        );
      })}
      {tabs.length === 0 ? (
        <Box sx={{ px: 1.5, py: 0.75 }}>
          <Typography color="text.secondary" variant="caption">
            {t("Open routes are kept here for quick return.")}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
