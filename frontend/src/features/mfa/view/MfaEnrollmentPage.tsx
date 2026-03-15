import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Grid from "@mui/material/Grid";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { useMfaController } from "@/features/mfa/controller/useMfaController";
import type { TotpEnrollmentFormValues, TotpVerificationFormValues } from "@/features/mfa/model/types";
import { totpEnrollmentSchema, totpVerificationSchema } from "@/features/mfa/model/validators";
import { RecoveryCodesCard } from "@/features/mfa/view/components/RecoveryCodesCard";
import { PageHeader } from "@/shared/components/page-header";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function MfaEnrollmentPage() {
  const navigate = useNavigate();
  const { createEnrollmentMutation, statusQuery, verifyEnrollmentMutation } = useMfaController();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const enrollmentForm = useForm<TotpEnrollmentFormValues>({
    defaultValues: { label: "Authenticator app" },
    resolver: zodResolver(totpEnrollmentSchema),
  });
  const verificationForm = useForm<TotpVerificationFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(totpVerificationSchema),
  });

  const currentSetup = createEnrollmentMutation.data;
  const hasVerifiedEnrollment = statusQuery.data?.has_verified_enrollment ?? false;
  const primaryEnrollment = statusQuery.data?.primary_enrollment;

  const helperText = useMemo(() => {
    if (!currentSetup) {
      return null;
    }
    return [
      `1. Add a TOTP account in your authenticator app with the secret ${currentSetup.secret}.`,
      "2. If your app accepts otpauth URIs directly, use the provisioning URI below.",
      "3. Enter the generated 6-digit code to finish enrollment.",
    ];
  }, [currentSetup]);

  const handleCreateSetup = enrollmentForm.handleSubmit(async (values) => {
    setErrorMessage(null);
    setRecoveryCodes([]);
    try {
      await createEnrollmentMutation.mutateAsync(values);
    } catch (error) {
      setErrorMessage(parseApiError(error));
    }
  });

  const handleVerify = verificationForm.handleSubmit(async (values) => {
    if (!currentSetup) {
      setErrorMessage("Create an enrollment setup before submitting a verification code.");
      return;
    }
    setErrorMessage(null);
    try {
      const result = await verifyEnrollmentMutation.mutateAsync({
        enrollment_id: currentSetup.enrollment_id,
        code: values.code,
      });
      setRecoveryCodes(result.recovery_codes);
    } catch (error) {
      setErrorMessage(parseApiError(error));
    }
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Enroll an authenticator app for TOTP-based MFA. Verified enrollments protect password login and issue one-time recovery codes."
        title="Security and MFA"
      />
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {hasVerifiedEnrollment && primaryEnrollment ? (
        <Alert severity="success">
          MFA is already enabled with {primaryEnrollment.label}. Recovery codes remaining: {statusQuery.data?.recovery_codes_remaining ?? 0}.
        </Alert>
      ) : (
        <Alert severity="warning">MFA is not enabled yet. Password login will remain single-factor until you verify an authenticator app.</Alert>
      )}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <Card>
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6">Create authenticator setup</Typography>
                <Typography color="text.secondary" variant="body2">
                  Use a label that makes sense for the device or authenticator app you are registering.
                </Typography>
                <FormProvider {...enrollmentForm}>
                  <Stack component="form" onSubmit={handleCreateSetup} spacing={2}>
                    <FormTextField label="Label" name="label" />
                    <Button disabled={createEnrollmentMutation.isPending} type="submit" variant="contained">
                      {createEnrollmentMutation.isPending ? <CircularProgress color="inherit" size={20} /> : "Create setup"}
                    </Button>
                  </Stack>
                </FormProvider>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Card>
            <CardContent>
              <Stack spacing={2.5}>
                <Typography variant="h6">Verify authenticator app</Typography>
                {currentSetup ? (
                  <Stack spacing={1.5}>
                    <Typography variant="body2">Secret: {currentSetup.secret}</Typography>
                    <Typography sx={{ wordBreak: "break-all" }} variant="body2">
                      Provisioning URI: {currentSetup.provisioning_uri}
                    </Typography>
                    {helperText?.map((item) => (
                      <Typography color="text.secondary" key={item} variant="body2">
                        {item}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Create a setup first to receive a TOTP secret and provisioning URI.
                  </Typography>
                )}
                <FormProvider {...verificationForm}>
                  <Stack component="form" onSubmit={handleVerify} spacing={2}>
                    <FormTextField label="Verification code" name="code" />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      <Button
                        disabled={verifyEnrollmentMutation.isPending || !currentSetup}
                        type="submit"
                        variant="contained"
                      >
                        {verifyEnrollmentMutation.isPending ? <CircularProgress color="inherit" size={20} /> : "Verify and enable MFA"}
                      </Button>
                      <Button onClick={() => navigate("/dashboard")} variant="outlined">
                        Skip for now
                      </Button>
                    </Stack>
                  </Stack>
                </FormProvider>
                {recoveryCodes.length > 0 ? (
                  <Button onClick={() => navigate("/dashboard", { replace: true })} variant="contained">
                    Continue to dashboard
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        {recoveryCodes.length > 0 ? (
          <Grid size={{ xs: 12 }}>
            <RecoveryCodesCard recoveryCodes={recoveryCodes} />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  );
}
