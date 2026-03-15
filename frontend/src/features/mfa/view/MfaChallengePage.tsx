import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import type { MfaChallengeFormValues } from "@/features/mfa/model/types";
import { mfaChallengeSchema } from "@/features/mfa/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function MfaChallengePage() {
  const navigate = useNavigate();
  const { completeMfaChallenge, pendingChallenge, clearPendingChallenge } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<MfaChallengeFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(mfaChallengeSchema),
  });

  const expiresLabel = useMemo(() => {
    if (!pendingChallenge) {
      return null;
    }
    return new Date(pendingChallenge.expiresAt).toLocaleString();
  }, [pendingChallenge]);

  if (!pendingChallenge) {
    return <Navigate replace to="/login" />;
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      const result = await completeMfaChallenge(values.code);
      navigate(result.mfaEnrollmentRequired ? "/mfa/enroll" : "/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(parseApiError(error));
    }
  });

  return (
    <Box
      sx={{
        alignItems: "center",
        background: "linear-gradient(135deg, #1f4b99 0%, #11294f 100%)",
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 520, width: "100%" }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h4">Verify multi-factor authentication</Typography>
              <Typography color="text.secondary" variant="body1">
                Enter the current code from your authenticator app or one of your recovery codes for {pendingChallenge.username}.
              </Typography>
              {expiresLabel ? (
                <Typography color="text.secondary" variant="body2">
                  This challenge expires at {expiresLabel}.
                </Typography>
              ) : null}
            </Stack>
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <FormProvider {...form}>
              <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
                <FormTextField autoComplete="one-time-code" label="Verification code" name="code" />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button disabled={form.formState.isSubmitting} type="submit" variant="contained">
                    {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : "Verify"}
                  </Button>
                  <Button
                    onClick={() => {
                      clearPendingChallenge();
                      navigate("/login", { replace: true });
                    }}
                    variant="outlined"
                  >
                    Back to login
                  </Button>
                </Stack>
              </Stack>
            </FormProvider>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
