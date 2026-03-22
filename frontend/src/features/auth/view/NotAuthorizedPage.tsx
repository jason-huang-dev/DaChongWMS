import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";

export function NotAuthorizedPage() {
  const { translateText } = useI18n();

  return (
    <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", minHeight: "100vh", p: 3 }}>
      <Card sx={{ maxWidth: 520, width: "100%" }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h4">{translateText("Not authorized")}</Typography>
            <Typography color="text.secondary">
              {translateText(
                "Your current staff role does not have access to this area. Use a supervisor or finance account, or return to the dashboard.",
              )}
            </Typography>
            <Button component={RouterLink} to="/dashboard" variant="contained">
              {translateText("Back to dashboard")}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
