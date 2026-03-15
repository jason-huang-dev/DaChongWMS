import { Box, Stack, Typography } from "@mui/material";

import { brandGradients } from "@/app/brand";
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
        <Box
          sx={{
            background: brandGradients.goldAccent,
            borderRadius: 999,
            boxShadow: "0 8px 18px rgba(181, 120, 18, 0.18)",
            height: 6,
            width: 68,
          }}
        />
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
