import type { ReactNode } from "react";

import Grid from "@mui/material/Grid";
import { Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

export interface DetailGridItem {
  label: string;
  value: ReactNode;
}

interface DetailGridProps {
  items: DetailGridItem[];
}

export function DetailGrid({ items }: DetailGridProps) {
  const { t, translate, msg } = useI18n();

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid key={item.label} size={{ xs: 12, md: 6, xl: 4 }}>
          <Stack spacing={0.5}>
            <Typography color="text.secondary" variant="body2">
              {t(item.label)}
            </Typography>
            <Typography variant="subtitle2">{item.value}</Typography>
          </Stack>
        </Grid>
      ))}
    </Grid>
  );
}
