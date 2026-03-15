import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  helper?: string;
}

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="body2">
            {label}
          </Typography>
          <Typography variant="h5">{value}</Typography>
          {helper ? (
            <Typography color="text.secondary" variant="body2">
              {helper}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
