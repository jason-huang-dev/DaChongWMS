import type { PropsWithChildren } from "react";

import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";

interface MutationCardProps extends PropsWithChildren {
  title: string;
  description: string;
  errorMessage?: string | null;
  successMessage?: string | null;
}

export function MutationCard({
  title,
  description,
  errorMessage,
  successMessage,
  children,
}: MutationCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.75}>
            <Typography variant="h6">{title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {description}
            </Typography>
          </Stack>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
