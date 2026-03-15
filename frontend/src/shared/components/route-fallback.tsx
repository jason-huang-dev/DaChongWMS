import { CircularProgress, Stack, Typography } from "@mui/material";

export function RouteFallback() {
  return (
    <Stack alignItems="center" justifyContent="center" minHeight="40vh" spacing={1.5}>
      <CircularProgress />
      <Typography color="text.secondary" variant="body2">
        Loading view...
      </Typography>
    </Stack>
  );
}
