import { ButtonBase, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { brandColors } from "@/app/brand";

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
              backgroundColor: isActive ? alpha(brandColors.gold, 0.16) : alpha(brandColors.surface, 0.82),
              border: `1px solid ${isActive ? alpha(brandColors.goldDark, 0.22) : alpha(brandColors.divider, 0.9)}`,
              borderRadius: 2,
              color: brandColors.ink,
              justifyContent: "space-between",
              minWidth: { xs: 180, lg: 0 },
              px: 1.5,
              py: 1.25,
              textAlign: "left",
            }}
          >
            <Stack spacing={0.25} sx={{ width: "100%" }}>
              <Typography sx={{ fontSize: 13, fontWeight: isActive ? 700 : 600 }} variant="body2">
                {item.label}
              </Typography>
              <Typography color="text.secondary" variant="caption">
                {item.count ?? "--"} items
              </Typography>
            </Stack>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
