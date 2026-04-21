import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useAuth } from "@/features/auth/controller/useAuthController";
import type { SignupFormValues } from "@/features/auth/model/types";
import { signupSchema } from "@/features/auth/model/validators";
import { SocialAuthButtons } from "@/features/auth/view/components/SocialAuthButtons";
import { AuthShell } from "@/shared/components/auth-shell";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function SignupPage() {
  const navigate = useNavigate();
  const { t, translate, msg } = useI18n();
  const { signup } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<SignupFormValues>({
    defaultValues: {
      name: "",
      email: "",
      password1: "",
      password2: "",
    },
    resolver: zodResolver(signupSchema),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      const result = await signup(values);
      navigate(result.mfaEnrollmentRequired ? "/mfa/enroll" : "/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(parseApiError(error));
    }
  });

  return (
    <AuthShell
      description="Create a manager account backed by Django auth, a tenant user profile, and a matching staff record, or bootstrap directly from a configured identity provider."
      heroPoints={["Tenant bootstrap ready", "Manager role by default", "Immediate MFA enrollment", "Provider-backed onboarding"]}
      heroSummary="The signup flow now follows the same industrial kinetic system as the operator shell, with cleaner surfaces and a tighter operational hierarchy."
      heroTitle="Provision a workspace with industrial clarity"
      title="Create workspace account"
    >
      <Stack spacing={3}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <FormProvider {...form}>
          <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
            <FormTextField autoComplete="username" label="Display name" name="name" />
            <FormTextField autoComplete="email" label="Email" name="email" type="email" />
            <FormTextField autoComplete="new-password" label="Password" name="password1" type="password" />
            <FormTextField autoComplete="new-password" label="Confirm password" name="password2" type="password" />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button disabled={form.formState.isSubmitting} size="large" type="submit" variant="contained">
                {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : t("Create account")}
              </Button>
              <Button component={RouterLink} size="large" to="/login" variant="outlined">
                {t("Back to login")}
              </Button>
            </Stack>
          </Stack>
        </FormProvider>
        <SocialAuthButtons />
      </Stack>
    </AuthShell>
  );
}
