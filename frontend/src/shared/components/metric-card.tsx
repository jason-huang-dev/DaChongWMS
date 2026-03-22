import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { useI18n } from "@/app/ui-preferences";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  const { translateText } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="body2">
            {translateText(label)}
          </Typography>
          <Typography variant="h5">{value}</Typography>
          {helper ? (
            <Typography color="text.secondary" variant="body2">
              {translateText(helper)}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
