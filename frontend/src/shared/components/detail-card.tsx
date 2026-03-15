import type { PropsWithChildren, ReactNode } from "react";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

interface DetailCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function DetailCard({ title, description, actions, children }: DetailCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">{title}</Typography>
              {description ? (
                <Typography color="text.secondary" variant="body2">
                  {description}
                </Typography>
              ) : null}
            </Box>
            {actions}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
