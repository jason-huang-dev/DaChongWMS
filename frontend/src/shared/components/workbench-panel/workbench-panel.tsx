import type { ReactNode } from "react";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

interface WorkbenchPanelProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkbenchPanel({ title, subtitle, actions, children }: WorkbenchPanelProps) {
  const { t, translate, msg } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6">{t(title)}</Typography>
              {subtitle ? (
                <Typography color="text.secondary" variant="body2">
                  {t(subtitle)}
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
