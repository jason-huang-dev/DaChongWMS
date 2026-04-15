import { Box, Tab, Tabs, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import type { NavigationItem } from "@/app/layout/navigation-items";

interface ModuleTopNavProps {
  activePath: string;
  compact?: boolean;
  items: NavigationItem[];
  onNavigate: (path: string) => void;
}

export function ModuleTopNav({ activePath, compact = true, items, onNavigate }: ModuleTopNavProps) {
  const theme = useTheme();
  const { t, translate } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const activeValue = items.find((item) => activePath === item.path || activePath.startsWith(`${item.path}/`))?.path ?? false;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
      <Tabs
        aria-label={t("Primary navigation")}
        allowScrollButtonsMobile={false}
        onChange={(_event, nextValue: string) => onNavigate(nextValue)}
        scrollButtons={false}
        textColor="inherit"
        value={activeValue}
        variant="scrollable"
        sx={{
          maxWidth: "100%",
          minHeight: compact ? 36 : 40,
          width: "100%",
          "& .MuiTabs-flexContainer, & .MuiTabs-list": {
            gap: compact ? 0.35 : 0.5,
            justifyContent: { sm: "center", xs: "flex-start" },
          },
          "& .MuiTabs-indicator": {
            backgroundColor: brandColors.accent,
            borderRadius: 999,
            height: 2,
          },
          "& .MuiTabs-scrollButtons": {
            display: "none !important",
          },
          "& .MuiTabs-scroller": {
            display: "flex",
            justifyContent: { sm: "center", xs: "flex-start" },
            overflowX: "auto !important",
            overflowY: "visible",
          },
        }}
      >
      {items.map((item) => {
        const Icon = item.icon;
        const label = translate(item.label);
        return (
          <Tab
            aria-label={label}
            icon={
              <Tooltip enterDelay={250} placement="bottom" title={label}>
                <Box component="span" sx={{ display: "inline-flex" }}>
                  <Icon fontSize="small" />
                </Box>
              </Tooltip>
            }
            key={item.path}
            sx={{
              alignItems: "center",
              borderRadius: 999,
              border: `1px solid ${alpha(
                brandColors.accentStrong,
                activeValue === item.path ? (isDark ? 0.28 : 0.18) : 0,
              )}`,
              color: alpha(theme.palette.text.primary, isDark ? 0.78 : 0.72),
              fontSize: compact ? 11 : 13,
              position: "relative",
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&::after": {
                backgroundColor: brandColors.accent,
                borderRadius: 999,
                bottom: 4,
                content: "\"\"",
                height: 3,
                left: 12,
                opacity: activeValue === item.path ? 1 : 0,
                position: "absolute",
                right: 12,
                transform: activeValue === item.path ? "scaleX(1)" : "scaleX(0.6)",
                transformOrigin: "center",
                transition: [
                  `opacity ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                  `transform ${brandMotion.duration.standard} ${brandMotion.easing.emphasized}`,
                ].join(", "),
              },
              "&:hover": {
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
                transform: "translateY(-1px)",
              },
              minHeight: compact ? 36 : 40,
              justifyContent: "center",
              minWidth: compact ? 32 : 36,
              px: compact ? 0.45 : 0.6,
              py: compact ? 0.2 : 0.25,
              textTransform: "none",
              "&.Mui-selected": {
                backgroundColor: alpha(brandColors.accent, isDark ? 0.14 : 0.1),
                boxShadow: `0 8px 18px ${alpha(brandColors.accentStrong, isDark ? 0.18 : 0.1)}`,
                color: theme.palette.text.primary,
              },
              "& .MuiSvgIcon-root": {
                fontSize: compact ? 24 : 26,
                marginBottom: "0 !important",
              },
              "& .MuiTab-iconWrapper": {
                marginRight: 0,
              },
              "& .MuiTab-wrapper": {
                gap: 0,
              },
              "& .MuiTab-icon": {
                marginBottom: "0 !important",
                marginRight: 0,
              },
              "& .MuiTab-root": {
                fontWeight: 600,
              },
            }}
            value={item.path}
          />
        );
      })}
      </Tabs>
    </Box>
  );
}
