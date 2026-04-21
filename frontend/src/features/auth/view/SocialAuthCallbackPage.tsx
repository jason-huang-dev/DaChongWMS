import { useEffect, useState } from "react";

import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import type { BaseAuthSession } from "@/features/auth/model/types";
import { AuthShell } from "@/shared/components/auth-shell";

function parseBoolean(value: string | null) {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function parseSocialCallback() {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;
  const params = new URLSearchParams(fragment || search);
  const error = params.get("error");
  if (error) {
    return { error: "Unable to complete social sign-in. Please try again." };
  }

  const openid = params.get("openid");
  const token = params.get("token");
  const name = params.get("name");
  const operatorId = Number(params.get("user_id"));

  if (!openid || !token || !name || !Number.isFinite(operatorId) || operatorId <= 0) {
    return { error: "The social sign-in response was incomplete." };
  }

  const companyId = params.get("company_id");
  const membershipId = params.get("membership_id");

  return {
    mfaEnrollmentRequired: parseBoolean(params.get("mfa_enrollment_required")),
    session: {
      username: name,
      openid,
      token,
      operatorId,
      companyId: companyId ? Number(companyId) : undefined,
      companyName: params.get("company_name") ?? undefined,
      membershipId: membershipId ? Number(membershipId) : undefined,
    } satisfies BaseAuthSession,
  };
}

export function SocialAuthCallbackPage() {
  const navigate = useNavigate();
  const { acceptExternalSession } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseSocialCallback();
    if ("error" in parsed) {
      setErrorMessage(parsed.error);
      return;
    }

    acceptExternalSession(parsed.session)
      .then(() => {
        navigate(parsed.mfaEnrollmentRequired ? "/mfa/enroll" : "/dashboard", { replace: true });
      })
      .catch(() => {
        setErrorMessage("The session could not be restored after social sign-in.");
      });
  }, [acceptExternalSession, navigate]);

  return (
    <AuthShell
      description="The browser is finalizing a backend-issued warehouse session after the identity provider callback."
      heroPoints={["Provider callback validation", "Backend-issued operator token", "Single hydration pass"]}
      heroSummary="Social sign-in is completed on the Django backend and translated into the same operator session the rest of the app already expects."
      heroTitle="Completing secure sign-in"
      title="Finalizing authentication"
    >
      <Stack spacing={3}>
        {errorMessage ? (
          <>
            <Alert severity="error">{errorMessage}</Alert>
            <Button component={RouterLink} to="/login" variant="contained">
              Back to login
            </Button>
          </>
        ) : (
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress />
            <Typography color="text.secondary" variant="body2">
              Establishing your operator session.
            </Typography>
          </Stack>
        )}
      </Stack>
    </AuthShell>
  );
}
