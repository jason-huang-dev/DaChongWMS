import type { PropsWithChildren } from "react";

import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface MutationCardProps extends PropsWithChildren {
  title?: TranslatableText;
  description?: TranslatableText;
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
  const { translate } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          {title || description ? (
            <Stack spacing={0.75}>
              {title ? <Typography variant="h6">{translate(title)}</Typography> : null}
              {description ? (
                <Typography color="text.secondary" variant="body2">
                  {translate(description)}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
