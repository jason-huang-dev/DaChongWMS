import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { useEffect } from "react";

import { defaultReturnDispositionValues } from "@/features/returns/model/mappers";
import type { ReturnDispositionCreateValues } from "@/features/returns/model/types";
import { returnDispositionCreateSchema } from "@/features/returns/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import {
  useLocationReferenceOptions,
  useReturnReceiptReferenceOptions,
  useWarehouseReferenceOptions,
} from "@/shared/hooks/use-reference-options";
import type { ReferenceOption } from "@/shared/types/options";

const dispositionTypeOptions: ReferenceOption<string>[] = [
  { value: "RESTOCK", label: "Restock", record: "RESTOCK" },
  { value: "QUARANTINE", label: "Quarantine", record: "QUARANTINE" },
  { value: "SCRAP", label: "Scrap", record: "SCRAP" },
];

interface ReturnDispositionPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: ReturnDispositionCreateValues) => Promise<unknown> | void;
  successMessage?: string | null;
}

export function ReturnDispositionPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: ReturnDispositionPanelProps) {
  const form = useForm<ReturnDispositionCreateValues>({
    defaultValues: defaultReturnDispositionValues,
    resolver: zodResolver(returnDispositionCreateSchema),
  });
  const selectedWarehouseId = form.watch("warehouse") || undefined;
  const dispositionType = form.watch("disposition_type");
  const selectedReceiptId = form.watch("return_receipt");

  const warehouses = useWarehouseReferenceOptions();
  const receipts = useReturnReceiptReferenceOptions(selectedWarehouseId);
  const locations = useLocationReferenceOptions(selectedWarehouseId);

  useEffect(() => {
    if (dispositionType === "SCRAP") {
      form.setValue("to_location", undefined, { shouldDirty: true });
    }
  }, [dispositionType, form]);

  useEffect(() => {
    const selectedReceipt = receipts.options.find((option) => option.value === selectedReceiptId)?.record;
    if (selectedReceipt && selectedReceipt.warehouse !== selectedWarehouseId) {
      form.setValue("warehouse", selectedReceipt.warehouse, { shouldDirty: true });
    }
  }, [form, receipts.options, selectedReceiptId, selectedWarehouseId]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset(defaultReturnDispositionValues);
  });

  return (
    <MutationCard
      description="Dispose received return stock through receipt and destination selectors instead of backend ids."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Record return disposition"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Return receipt" name="return_receipt" reference={receipts} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Disposition number" name="disposition_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Disposition type" name="disposition_type" options={dispositionTypeOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Quantity" name="quantity" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField
                disabled={dispositionType === "SCRAP"}
                label="Destination location"
                name="to_location"
                reference={locations}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" multiline minRows={3} name="notes" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Posting..." : "Post return disposition"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
