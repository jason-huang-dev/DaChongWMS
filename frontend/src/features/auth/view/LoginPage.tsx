import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { config } from "@/lib/config";
import { useAuth } from "@/features/auth/controller/useAuthController";
import type { LoginFormValues } from "@/features/auth/model/types";
import { loginSchema } from "@/features/auth/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function LoginPage() {
  const navigate = useNavigate();
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
      <Card sx={{ maxWidth: 480, width: "100%" }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h4">DaChongWMS</Typography>
              <Typography color="text.secondary" variant="body1">
                Sign in with your warehouse account. The frontend uses the backend login endpoint and keeps the tenant TOKEN and operator id in browser storage for API access.
              </Typography>
            </Stack>
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <FormProvider {...form}>
              <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
                <FormTextField autoComplete="username" label="User name" name="name" />
                <FormTextField autoComplete="current-password" label="Password" name="password" type="password" />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button disabled={form.formState.isSubmitting} size="large" type="submit" variant="contained">
                    {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : "Sign in"}
                  </Button>
                  <Button component={RouterLink} size="large" to="/signup" variant="outlined">
                    Sign up
                  </Button>
                </Stack>
              </Stack>
            </FormProvider>
            {config.enableTestSystem ? (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Developer bootstrap</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Use the backend test-system module to seed a demo tenant, then continue straight into the app.
                  </Typography>
                  <Button disabled={isBootstrapping} onClick={handleBootstrap} variant="outlined">
                    {isBootstrapping ? <CircularProgress color="inherit" size={20} /> : "Create demo workspace"}
                  </Button>
                </Stack>
              </>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
