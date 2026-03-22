import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useAuth } from "@/features/auth/controller/useAuthController";
import type { MfaChallengeFormValues } from "@/features/mfa/model/types";
import { mfaChallengeSchema } from "@/features/mfa/model/validators";
import { AuthShell } from "@/shared/components/auth-shell";
import { FormTextField } from "@/shared/components/form-text-field";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function MfaChallengePage() {
  const navigate = useNavigate();
  const { t, translateText } = useI18n();
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
    return formatDateTime(pendingChallenge.expiresAt);
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
    <AuthShell
      description={t("auth.challengeDescription", { username: pendingChallenge.username })}
      heroPoints={["Time-bound challenge", "Recovery-code fallback", "Session issued only after verification"]}
      heroSummary="MFA challenges stay outside the authenticated route tree and use the same DaChong visual system as login and signup."
      heroTitle="Step-up verification before warehouse access"
      title="Verify multi-factor authentication"
    >
      <Stack spacing={3}>
        {expiresLabel ? (
          <Typography color="text.secondary" variant="body2">
            {t("auth.challengeExpiresAt", { value: expiresLabel })}
          </Typography>
        ) : null}
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <FormProvider {...form}>
          <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
            <FormTextField autoComplete="one-time-code" label="Verification code" name="code" />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button disabled={form.formState.isSubmitting} type="submit" variant="contained">
                {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : translateText("Verify")}
              </Button>
              <Button
                onClick={() => {
                  clearPendingChallenge();
                  navigate("/login", { replace: true });
                }}
                variant="outlined"
              >
                {translateText("Back to login")}
              </Button>
            </Stack>
          </Stack>
        </FormProvider>
      </Stack>
    </AuthShell>
  );
}
