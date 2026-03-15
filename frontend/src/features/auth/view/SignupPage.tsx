import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import type { SignupFormValues } from "@/features/auth/model/types";
import { signupSchema } from "@/features/auth/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function SignupPage() {
  const navigate = useNavigate();
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
              <Typography variant="h4">Create workspace account</Typography>
              <Typography color="text.secondary" variant="body1">
                Create a manager account backed by Django auth, a tenant user profile, and a matching staff record. Email is required now so MFA enrollment and recovery can be added without changing the account model later.
              </Typography>
            </Stack>
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <FormProvider {...form}>
              <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
                <FormTextField autoComplete="username" label="User name" name="name" />
                <FormTextField autoComplete="email" label="Email" name="email" type="email" />
                <FormTextField autoComplete="new-password" label="Password" name="password1" type="password" />
                <FormTextField
                  autoComplete="new-password"
                  label="Confirm password"
                  name="password2"
                  type="password"
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button disabled={form.formState.isSubmitting} size="large" type="submit" variant="contained">
                    {form.formState.isSubmitting ? <CircularProgress color="inherit" size={20} /> : "Create account"}
                  </Button>
                  <Button component={RouterLink} size="large" to="/login" variant="outlined">
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
