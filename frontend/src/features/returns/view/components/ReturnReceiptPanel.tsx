import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import { defaultReturnReceiptValues } from "@/features/returns/model/mappers";
import { returnsApi } from "@/features/returns/model/api";
import type { ReturnOrderRecord, ReturnReceiptCreateValues } from "@/features/returns/model/types";
import { returnReceiptCreateSchema } from "@/features/returns/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import {
  useLocationReferenceOptions,
  useReturnOrderReferenceOptions,
  useWarehouseReferenceOptions,
} from "@/shared/hooks/use-reference-options";
import { useResource } from "@/shared/hooks/use-resource";
import type { ReferenceOption } from "@/shared/types/options";

const stockStatusOptions: ReferenceOption<string>[] = [
  { value: "AVAILABLE", label: "Available", record: "AVAILABLE" },
  { value: "QUARANTINE", label: "Quarantine", record: "QUARANTINE" },
  { value: "DAMAGED", label: "Damaged", record: "DAMAGED" },
];

interface ReturnReceiptPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: ReturnReceiptCreateValues) => Promise<unknown> | void;
  successMessage?: string | null;
}

type ReturnReceiptFormValues = ReturnReceiptCreateValues & {
  return_order: number;
};

const returnReceiptFormSchema = returnReceiptCreateSchema.extend({
  return_order: z.coerce.number().int().positive("Return order is required"),
});

export function ReturnReceiptPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: ReturnReceiptPanelProps) {
  const form = useForm<ReturnReceiptFormValues>({
    defaultValues: {
      ...defaultReturnReceiptValues,
      return_order: 0,
    },
    resolver: zodResolver(returnReceiptFormSchema),
  });
  const selectedWarehouseId = form.watch("warehouse") || undefined;
  const selectedReturnOrderId = form.watch("return_order") as number | undefined;

  const warehouses = useWarehouseReferenceOptions();
  const returnOrders = useReturnOrderReferenceOptions(selectedWarehouseId);
  const locations = useLocationReferenceOptions(selectedWarehouseId);
  const returnOrderQuery = useResource<ReturnOrderRecord>(
    ["returns", "return-order-reference", selectedReturnOrderId],
    `${returnsApi.returnOrders}${selectedReturnOrderId}/`,
    undefined,
    { enabled: Boolean(selectedReturnOrderId) },
  );

  const lineOptions = useMemo(() => {
    return (returnOrderQuery.data?.lines ?? []).map((line) => ({
      value: line.id,
      label: `Line ${line.line_number} · ${line.goods_code}`,
      description: `${line.expected_qty} expected · ${line.received_qty} received`,
      record: line,
    }));
  }, [returnOrderQuery.data?.lines]);

  useEffect(() => {
    const selectedReturnOrder = returnOrders.options.find((option) => option.value === selectedReturnOrderId)?.record;
    if (selectedReturnOrder && selectedReturnOrder.warehouse !== selectedWarehouseId) {
      form.setValue("warehouse", selectedReturnOrder.warehouse, { shouldDirty: true });
    }
  }, [form, returnOrders.options, selectedReturnOrderId, selectedWarehouseId]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { return_order: _returnOrder, ...payload } = values;
    await onSubmit(payload);
    form.reset({
      ...defaultReturnReceiptValues,
      return_order: 0,
    });
  });

  return (
    <MutationCard
      description="Post returned stock from return-order and line selectors instead of manually entering line and location ids."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Record return receipt"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Return order" name="return_order" reference={returnOrders} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete
                label="Return line"
                name="return_line"
                options={lineOptions}
                loading={returnOrderQuery.isLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Receipt location" name="receipt_location" reference={locations} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Receipt number" name="receipt_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Received quantity" name="received_qty" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Stock status" name="stock_status" options={stockStatusOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Lot number" name="lot_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Serial number" name="serial_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Notes" name="notes" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Posting..." : "Post return receipt"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
