import { CircularProgress, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

export function RouteFallback() {
  const { translateText } = useI18n();

  return (
    <Stack alignItems="center" justifyContent="center" minHeight="40vh" spacing={1.5}>
      <CircularProgress />
      <Typography color="text.secondary" variant="body2">
        {translateText("Loading view...")}
      </Typography>
    </Stack>
  );
}
