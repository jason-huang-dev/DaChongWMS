import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import { integrationSystemOptions } from "@/features/integrations/model/mappers";
import type { WebhookEventCreateValues } from "@/features/integrations/model/types";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import { MutationCard } from "@/shared/components/mutation-card";
import type { WarehouseRecord } from "@/shared/types/domain";
import type { ReferenceOption } from "@/shared/types/options";

const systemOptions: ReferenceOption<string>[] = integrationSystemOptions.map((option) => ({ ...option, record: option.value }));

interface WebhookEventFormProps {
  form: UseFormReturn<WebhookEventCreateValues>;
  isPending: boolean;
  onSubmit: (values: WebhookEventCreateValues) => void;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
}

export function WebhookEventForm({
  form,
  isPending,
  onSubmit,
  warehouseReference,
}: WebhookEventFormProps) {
  return (
    <MutationCard
      description="Intake external webhook events into the backend using structured JSON inputs."
      title="Intake webhook"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouseReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="System type" name="system_type" options={systemOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Source system" name="source_system" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Event type" name="event_type" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Event key" name="event_key" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Signature" name="signature" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Headers JSON" multiline minRows={4} name="headers_json" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Payload JSON" multiline minRows={4} name="payload_json" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Intaking..." : "Intake webhook"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
