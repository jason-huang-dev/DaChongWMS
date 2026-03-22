import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import {
  defaultInventoryAdjustmentValues,
} from "@/features/inventory/model/mappers";
import type { InventoryAdjustmentValues } from "@/features/inventory/model/types";
import { inventoryAdjustmentSchema } from "@/features/inventory/model/validators";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import type { InventoryBalanceRecord } from "@/shared/types/domain";

interface InventoryAdjustmentFormProps {
  errorMessage?: string | null;
  isSubmitting: boolean;
  inventoryBalanceReference: ReferenceListState<number, InventoryBalanceRecord>;
  onSubmit: (values: InventoryAdjustmentValues) => Promise<unknown> | unknown;
  successMessage?: string | null;
}

export function InventoryAdjustmentForm({
  errorMessage,
  isSubmitting,
  inventoryBalanceReference,
  onSubmit,
  successMessage,
}: InventoryAdjustmentFormProps) {
  const form = useForm<InventoryAdjustmentValues>({
    defaultValues: defaultInventoryAdjustmentValues,
    resolver: zodResolver(inventoryAdjustmentSchema),
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset(defaultInventoryAdjustmentValues);
  });

  return (
    <MutationCard
      description="Post supervisor-led adjustment in or out movements against an existing stock position."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create inventory adjustment"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12 }}>
              <ReferenceAutocompleteField
                emptyText="Inventory positions will appear after a warehouse is selected."
                label="Inventory position"
                name="balance_id"
                reference={inventoryBalanceReference}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Adjustment type" name="movement_type" select>
                <MenuItem value="ADJUSTMENT_OUT">Adjustment out</MenuItem>
                <MenuItem value="ADJUSTMENT_IN">Adjustment in</MenuItem>
              </FormTextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Quantity" name="quantity" type="number" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Reason" name="reason" placeholder="COUNT_VAR" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Reference code" name="reference_code" placeholder="ADJ-20260321-01" />
            </Grid>
          </Grid>
          <Button disabled={isSubmitting} type="submit" variant="contained">
            {isSubmitting ? "Posting..." : "Post adjustment"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
