import type { ReactNode } from "react";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface WorkbenchPanelProps {
  title: TranslatableText;
  subtitle?: TranslatableText;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkbenchPanel({ title, subtitle, actions, children }: WorkbenchPanelProps) {
  const { translate } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6">{translate(title)}</Typography>
              {subtitle ? (
                <Typography color="text.secondary" variant="body2">
                  {translate(subtitle)}
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
