import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useWaveCreateController } from "@/features/outbound/controller/useOutboundController";
import type { WaveCreateValues } from "@/features/outbound/model/types";
import { waveCreateSchema } from "@/features/outbound/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { useWarehouseReferenceOptions } from "@/shared/hooks/use-reference-options";

const defaultValues: WaveCreateValues = {
  warehouse: 0,
  wave_number: "",
  sales_order_ids: "",
  notes: "",
};

export function GenerateWavePanel() {
  const { mutation, successMessage, errorMessage } = useWaveCreateController();
  const warehouses = useWarehouseReferenceOptions();
  const form = useForm<WaveCreateValues>({
    defaultValues,
    resolver: zodResolver(waveCreateSchema),
  });

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => form.reset(defaultValues),
    }),
  );

  return (
    <MutationCard
      description="Generate a wave for a batch of sales orders. Enter outbound sales order ids separated by commas or spaces."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Generate wave"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Wave number" name="wave_number" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField
                helperText="Example: 101, 102, 103"
                label="Sales order ids"
                minRows={3}
                multiline
                name="sales_order_ids"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" minRows={2} multiline name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Generating..." : "Generate wave"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
