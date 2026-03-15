import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
      <Stack spacing={0.75}>
        <Typography variant="h4">{title}</Typography>
        {description ? (
          <Typography color="text.secondary" variant="body1">
            {description}
          </Typography>
        ) : null}
      </Stack>
      {actions}
    </Stack>
  );
}
