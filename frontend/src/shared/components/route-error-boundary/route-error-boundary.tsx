import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink, isRouteErrorResponse, useRouteError } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";

function getRouteErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data;
    }
    if (error.statusText) {
      return error.statusText;
    }
    return `HTTP ${error.status}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

function getRouteErrorDetails(error: unknown) {
  if (!import.meta.env.DEV) {
    return null;
  }

  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  if (isRouteErrorResponse(error)) {
    const routeError = {
      data: error.data,
      status: error.status,
      statusText: error.statusText,
    };
    return JSON.stringify(routeError, null, 2);
  }

  return null;
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const { t } = useI18n();
  const message = getRouteErrorMessage(error);
  const details = getRouteErrorDetails(error);

  return (
    <Stack alignItems="center" justifyContent="center" minHeight="50vh" px={2.5} py={4} spacing={2}>
      <Stack maxWidth={720} spacing={2} width="100%">
        <Stack spacing={0.75}>
          <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {t("Something went wrong")}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t("An unexpected error interrupted this view.")}
          </Typography>
        </Stack>

        {message ? <Alert severity="error">{message}</Alert> : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <Button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            variant="contained"
          >
            {t("Reload page")}
          </Button>
          <Button component={RouterLink} to="/dashboard" variant="outlined">
            {t("Back to dashboard")}
          </Button>
        </Stack>

        {details ? (
          <Box
            component="details"
            sx={{
              backgroundColor: "background.paper",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              overflow: "hidden",
              px: 1.5,
              py: 1.25,
            }}
          >
            <Typography component="summary" sx={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              {t("Error details")}
            </Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: "monospace",
                fontSize: 12,
                m: 0,
                mt: 1.5,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {details}
            </Box>
          </Box>
        ) : null}
      </Stack>
    </Stack>
  );
}
