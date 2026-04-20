import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import {
  integrationDirectionOptions,
  integrationJobTypeOptions,
  integrationSystemOptions,
} from "@/features/integrations/model/mappers";
import type { IntegrationJobCreateValues } from "@/features/integrations/model/types";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import { MutationCard } from "@/shared/components/mutation-card";
import type { WarehouseRecord, WebhookEventRecord } from "@/shared/types/domain";
import type { ReferenceOption } from "@/shared/types/options";

const systemOptions: ReferenceOption<string>[] = integrationSystemOptions.map((option) => ({ ...option, record: option.value }));
const directionOptions: ReferenceOption<string>[] = integrationDirectionOptions.map((option) => ({ ...option, record: option.value }));
const jobTypeOptions: ReferenceOption<string>[] = integrationJobTypeOptions.map((option) => ({ ...option, record: option.value }));

interface IntegrationFormProps {
  errorMessage?: string | null;
  form: UseFormReturn<IntegrationJobCreateValues>;
  isPending: boolean;
  onSubmit: (values: IntegrationJobCreateValues) => void;
  sourceWebhookReference: ReferenceListState<number, WebhookEventRecord>;
  successMessage?: string | null;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
}

export function IntegrationForm({
  errorMessage,
  form,
  isPending,
  onSubmit,
  sourceWebhookReference,
  successMessage,
  warehouseReference,
}: IntegrationFormProps) {
  return (
    <MutationCard
      description="Create ERP, carrier, and webhook-driven jobs with explicit selector-backed references."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create integration job"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouseReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Source webhook" name="source_webhook" reference={sourceWebhookReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="System type" name="system_type" options={systemOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Integration name" name="integration_name" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Job type" name="job_type" options={jobTypeOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Direction" name="direction" options={directionOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="External reference" name="external_reference" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Request payload JSON" multiline minRows={5} name="request_payload_json" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create integration job"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
