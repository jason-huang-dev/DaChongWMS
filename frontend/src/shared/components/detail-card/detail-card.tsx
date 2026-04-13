import type { PropsWithChildren, ReactNode } from "react";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface DetailCardProps extends PropsWithChildren {
  title: TranslatableText;
  description?: TranslatableText;
  actions?: ReactNode;
}

export function DetailCard({ title, description, actions, children }: DetailCardProps) {
  const { translate } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h6">{translate(title)}</Typography>
              {description ? (
                <Typography color="text.secondary" variant="body2">
                  {translate(description)}
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
