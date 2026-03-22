import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import type { NavigationItem } from "@/app/layout/navigation-items";

interface ModuleTopNavProps {
  activePath: string;
  items: NavigationItem[];
  onNavigate: (path: string) => void;
}

export function ModuleTopNav({ activePath, items, onNavigate }: ModuleTopNavProps) {
  const theme = useTheme();
  const { translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";

  return (
    <Stack direction="row" spacing={1} sx={{ minWidth: 0, overflowX: "auto", pb: 0.5 }}>
      {items.map((item) => {
        const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);
        const Icon = item.icon;
        return (
          <ButtonBase
            key={item.path}
            onClick={() => onNavigate(item.path)}
            sx={{
              alignItems: "center",
              borderBottom: `2px solid ${isActive ? brandColors.gold : "transparent"}`,
              borderRadius: 0,
              color: isActive ? theme.palette.text.primary : alpha(theme.palette.text.primary, isDark ? 0.76 : 0.72),
              gap: 1,
              minWidth: "max-content",
              px: 1.25,
              py: 1,
            }}
          >
            <Icon fontSize="small" />
            <Typography sx={{ fontSize: 13, fontWeight: isActive ? 700 : 600 }} variant="body2">
              {translateText(item.label)}
            </Typography>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
