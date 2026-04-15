import { ButtonBase, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";

export interface StatusBucketItem {
  value: string;
  label: string;
  count?: number | string;
}

interface StatusBucketNavProps {
  activeValue: string;
  items: StatusBucketItem[];
  onChange: (value: string) => void;
}

export function StatusBucketNav({ activeValue, items, onChange }: StatusBucketNavProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const liveColor = isDark ? brandStatusColors.info.dark : brandStatusColors.info.light;

  return (
    <Stack direction={{ xs: "row", lg: "column" }} gap={1} sx={{ overflowX: "auto" }}>
      {items.map((item) => {
        const isActive = item.value === activeValue;
        return (
          <ButtonBase
            key={item.value}
            onClick={() => onChange(item.value)}
            sx={{
              alignItems: "flex-start",
              backgroundColor: isActive
                ? alpha(brandColors.accent, isDark ? 0.16 : 0.12)
                : alpha(theme.palette.background.paper, isDark ? 0.9 : 0.98),
              border: `1px solid ${
                isActive
                  ? alpha(brandColors.accentStrong, isDark ? 0.32 : 0.24)
                  : alpha(theme.palette.divider, 0.88)
              }`,
              borderRadius: 3,
              boxShadow: isActive
                ? `inset 3px 0 0 ${brandColors.accent}, ${isDark ? brandShadows.floatingDark : brandShadows.floatingLight}`
                : "none",
              color: theme.palette.text.primary,
              justifyContent: "space-between",
              minWidth: { xs: 180, lg: 0 },
              overflow: "hidden",
              px: 1.5,
              py: 1.25,
              textAlign: "left",
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:hover": {
                backgroundColor: isActive
                  ? alpha(brandColors.accent, isDark ? 0.2 : 0.15)
                  : alpha(theme.palette.background.paper, isDark ? 0.98 : 1),
                borderColor: alpha(isActive ? brandColors.accentStrong : liveColor, isDark ? 0.36 : 0.28),
                transform: "translateY(-1px)",
              },
              "&:focus-visible": {
                outline: `2px solid ${alpha(liveColor, 0.9)}`,
                outlineOffset: 2,
              },
              "&:active": {
                transform: "translateY(0)",
              },
              "&::after": {
                backgroundColor: isActive ? brandColors.accent : alpha(liveColor, 0.28),
                borderRadius: 999,
                content: "\"\"",
                height: 8,
                position: "absolute",
                right: 14,
                top: 14,
                transition: `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                width: 8,
              },
            }}
          >
            <Stack spacing={0.25} sx={{ width: "100%" }}>
              <Typography sx={{ fontSize: 13, fontWeight: isActive ? 700 : 600 }} variant="body2">
                {item.label}
              </Typography>
              {item.count !== undefined ? (
                <Typography color="text.secondary" variant="caption">
                  {item.count} items
                </Typography>
              ) : null}
            </Stack>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
