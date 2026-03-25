import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Alert, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { config } from "@/lib/config";
import { useAuth } from "@/features/auth/controller/useAuthController";
import type { LoginFormValues } from "@/features/auth/model/types";
import { loginSchema } from "@/features/auth/model/validators";
import { AuthShell } from "@/shared/components/auth-shell";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function LoginPage() {
  const navigate = useNavigate();
  const { translateText } = useI18n();
  const { login, bootstrap } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const form = useForm<LoginFormValues>({
    defaultValues: {
      name: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    try {
      const result = await login(values.name, values.password);
      if (result.kind === "mfa_challenge") {
        navigate("/mfa/challenge", { replace: true });
        return;
      }
      navigate(result.mfaEnrollmentRequired ? "/mfa/enroll" : "/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(parseApiError(error));
    }
  });

  const handleBootstrap = async () => {
    setErrorMessage(null);
    setIsBootstrapping(true);
    try {
      await bootstrap();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(parseApiError(error));
    } finally {
      setIsBootstrapping(false);
    }
  };

  return (
    <AuthShell
      description="Sign in with your warehouse account. The frontend uses the backend login endpoint and keeps the tenant token and operator id in browser storage for API access."
      heroPoints={["Scanner-first receiving", "Inventory and finance controls", "MFA-backed sign-in"]}
      heroSummary="The operator shell now uses industrial surface layering, restrained yellow emphasis, and sharper hierarchy instead of generic dashboard defaults."
      heroTitle="Precision-built access for every warehouse role"
      title="Sign in to the operator console"
    >
      <Stack spacing={3}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        <FormProvider {...form}>
          <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
            <FormTextField autoComplete="username" label="User name" name="name" />
            <FormTextField autoComplete="current-password" label="Password" name="password" type="password" />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button disabled={form.formState.isSubmitting} size="large" type="submit" variant="contained">
                {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : translateText("Sign in")}
              </Button>
              <Button component={RouterLink} size="large" to="/signup" variant="outlined">
                {translateText("Sign up")}
              </Button>
            </Stack>
          </Stack>
        </FormProvider>
        {config.enableTestSystem ? (
          <>
            <Divider />
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">{translateText("Developer bootstrap")}</Typography>
              <Typography color="text.secondary" variant="body2">
                {translateText("Use the stable development account. If it does not exist yet, the backend creates it once, seeds the default workspace, and signs you in.")}
              </Typography>
              <Button disabled={isBootstrapping} onClick={handleBootstrap} variant="outlined">
                {isBootstrapping ? <CircularProgress color="inherit" size={20} /> : translateText("Use dev workspace")}
              </Button>
            </Stack>
          </>
        ) : null}
      </Stack>
    </AuthShell>
  );
}
