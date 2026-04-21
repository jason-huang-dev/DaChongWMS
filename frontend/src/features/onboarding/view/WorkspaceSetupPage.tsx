import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { fetchWorkspaceOnboardingStatus, submitWorkspaceSetup } from "@/features/onboarding/model/api";
import type { WorkspaceSetupFormValues } from "@/features/onboarding/model/types";
import { workspaceSetupSchema } from "@/features/onboarding/model/validators";
import { AuthShell } from "@/shared/components/auth-shell";
import { FormTextField } from "@/shared/components/form-text-field";
import { parseApiError } from "@/shared/utils/parse-api-error";

const defaultValues: WorkspaceSetupFormValues = {
  warehouse_name: "Main Warehouse",
  warehouse_code: "MAIN",
  storage_area_name: "Primary Storage",
  storage_area_code: "STOR",
  location_type_name: "Storage Bin",
  location_type_code: "BIN",
  shelf_prefix: "A",
  aisle_count: 2,
  bay_count: 4,
  level_count: 3,
  slot_count: 1,
};

export function WorkspaceSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["auth", "onboarding", "workspace-setup"],
    queryFn: fetchWorkspaceOnboardingStatus,
  });

  const form = useForm<WorkspaceSetupFormValues>({
    defaultValues,
    resolver: zodResolver(workspaceSetupSchema),
  });

  const watchedValues = form.watch();
  const plannedLocations = useMemo(
    () =>
      Number(watchedValues.aisle_count || 0) *
      Number(watchedValues.bay_count || 0) *
      Number(watchedValues.level_count || 0) *
      Number(watchedValues.slot_count || 0),
    [
      watchedValues.aisle_count,
      watchedValues.bay_count,
      watchedValues.level_count,
      watchedValues.slot_count,
    ],
  );

  const setupMutation = useMutation({
    mutationFn: submitWorkspaceSetup,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth", "onboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["scope", "warehouses"] }),
      ]);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      setErrorMessage(parseApiError(error));
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    setErrorMessage(null);
    setupMutation.mutate(values);
  });

  if (statusQuery.isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (statusQuery.data && !statusQuery.data.is_required) {
    return <Navigate replace to="/dashboard" />;
  }

  return (
    <AuthShell
      description="Create the minimum warehouse topology required before operators can receive, store, pick, and count inventory."
      heroPoints={["Warehouse master", "Storage area", "Shelf grid", "Location type"]}
      heroSummary="This one-time setup creates real IAM-controlled warehouse and location records, not a temporary onboarding profile."
      heroTitle="Build your first warehouse map"
      title="Set up your warehouse"
    >
      <Stack spacing={3}>
        {statusQuery.error ? <Alert severity="warning">{parseApiError(statusQuery.error)}</Alert> : null}
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 2,
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">{t("Setup plan")}</Typography>
            <Typography color="text.secondary" variant="body2">
              {t("This will create {{count}} shelf locations in the first storage area.", {
                count: Number.isFinite(plannedLocations) ? plannedLocations : 0,
              })}
            </Typography>
          </Stack>
        </Box>

        <FormProvider {...form}>
          <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5}>
            <Stack spacing={2}>
              <Typography variant="h6">{t("Warehouse")}</Typography>
              <FormTextField label="Warehouse name" name="warehouse_name" />
              <FormTextField label="Warehouse code" name="warehouse_code" />
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">{t("Storage area")}</Typography>
              <FormTextField label="Storage area name" name="storage_area_name" />
              <FormTextField label="Storage area code" name="storage_area_code" />
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">{t("Shelf grid")}</Typography>
              <FormTextField label="Shelf prefix" name="shelf_prefix" />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <FormTextField inputProps={{ min: 1, max: 20 }} label="Aisles" name="aisle_count" type="number" />
                <FormTextField inputProps={{ min: 1, max: 50 }} label="Bays" name="bay_count" type="number" />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <FormTextField inputProps={{ min: 1, max: 10 }} label="Levels" name="level_count" type="number" />
                <FormTextField inputProps={{ min: 1, max: 20 }} label="Slots" name="slot_count" type="number" />
              </Stack>
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Typography variant="h6">{t("Location type")}</Typography>
              <FormTextField label="Location type name" name="location_type_name" />
              <FormTextField label="Location type code" name="location_type_code" />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button disabled={setupMutation.isPending} size="large" type="submit" variant="contained">
                {setupMutation.isPending ? <CircularProgress color="inherit" size={20} /> : t("Create warehouse setup")}
              </Button>
            </Stack>
          </Stack>
        </FormProvider>
      </Stack>
    </AuthShell>
  );
}
