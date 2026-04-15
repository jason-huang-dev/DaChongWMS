import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import { Button, Divider, Grid, IconButton, Stack } from "@mui/material";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import { defaultTransferOrderCreateValues } from "@/features/transfers/model/mappers";
import type { InventoryBalanceRecord, TransferOrderCreateValues } from "@/features/transfers/model/types";
import { transferOrderCreateSchema } from "@/features/transfers/model/validators";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import {
  useInventoryBalanceReferenceOptions,
  useLocationReferenceOptions,
  useWarehouseReferenceOptions,
} from "@/shared/hooks/use-reference-options";

const emptyLine = {
  source_balance: 0,
  to_location: 0,
  requested_qty: 0,
};

interface CreateTransferOrderPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: TransferOrderCreateValues, balancesById: Map<number, InventoryBalanceRecord>) => Promise<unknown> | void;
  successMessage?: string | null;
}

export function CreateTransferOrderPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: CreateTransferOrderPanelProps) {
  const { t, msg } = useI18n();
  const form = useForm<TransferOrderCreateValues>({
    defaultValues: defaultTransferOrderCreateValues,
    resolver: zodResolver(transferOrderCreateSchema),
  });
  const { control, reset, watch } = form;
  const selectedWarehouseId = watch("warehouse") || undefined;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const warehouses = useWarehouseReferenceOptions();
  const balances = useInventoryBalanceReferenceOptions(selectedWarehouseId);
  const locations = useLocationReferenceOptions(selectedWarehouseId);

  const balancesById = useMemo(
    () => new Map(balances.options.map((option) => [option.value, option.record])),
    [balances.options],
  );

  useEffect(() => {
    form.setValue("line_items", [emptyLine]);
  }, [form, selectedWarehouseId]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values, balancesById);
    reset(defaultTransferOrderCreateValues);
  });

  return (
    <MutationCard
      description="Plan transfer orders from current inventory balances and destination-location selectors."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create transfer order"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Transfer number" name="transfer_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField InputLabelProps={{ shrink: true }} label="Requested date" name="requested_date" type="date" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Notes" name="notes" />
            </Grid>
          </Grid>
          <Divider />
          <Stack spacing={1.5}>
            {fields.map((field, index) => (
              <Grid container spacing={1.5} key={field.id}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <ReferenceAutocompleteField
                    label={msg("Source SKU/location {{index}}", { index: index + 1 })}
                    name={`line_items.${index}.source_balance`}
                    reference={balances}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <ReferenceAutocompleteField
                    label="Destination location"
                    name={`line_items.${index}.to_location`}
                    reference={locations}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormTextField label="Requested qty" name={`line_items.${index}.requested_qty`} type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }}>
                  <IconButton
                    aria-label={t("Remove line {{index}}", { index: index + 1 })}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                    sx={{ mt: 1 }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button onClick={() => append(emptyLine)} startIcon={<AddOutlined />} type="button" variant="text">
              Add line
            </Button>
          </Stack>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create transfer order"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
