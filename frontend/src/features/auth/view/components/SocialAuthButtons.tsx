import { useEffect, useState } from "react";

import AppleIcon from "@mui/icons-material/Apple";
import GoogleIcon from "@mui/icons-material/Google";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";

import { fetchSocialAuthProviders } from "@/features/auth/model/api";
import type { SocialAuthProviderRecord } from "@/features/auth/model/types";

function providerIcon(provider: string) {
  switch (provider) {
    case "apple":
      return <AppleIcon fontSize="small" />;
    case "google":
      return <GoogleIcon fontSize="small" />;
    case "weixin":
      return <QrCode2Icon fontSize="small" />;
    default:
      return undefined;
  }
}

export function SocialAuthButtons() {
  const [providers, setProviders] = useState<SocialAuthProviderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    fetchSocialAuthProviders()
      .then((response) => {
        if (!isActive) {
          return;
        }
        setProviders(response.results);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setProviders([]);
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading) {
    return (
      <Stack alignItems="center" py={1}>
        <CircularProgress size={20} />
      </Stack>
    );
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Divider />
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Continue with a trusted identity provider</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {providers.map((provider) => (
            <Button
              key={provider.id}
              onClick={() => window.location.assign(provider.login_url)}
              startIcon={providerIcon(provider.id)}
              variant="outlined"
            >
              {provider.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
