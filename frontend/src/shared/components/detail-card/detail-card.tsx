import type { PropsWithChildren, ReactNode } from "react";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

interface DetailCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function DetailCard({ title, description, actions, children }: DetailCardProps) {
  const { t, translate, msg } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">{t(title)}</Typography>
              {description ? (
                <Typography color="text.secondary" variant="body2">
                  {t(description)}
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
