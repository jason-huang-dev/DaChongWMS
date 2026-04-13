import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import { Button, Divider, Grid, IconButton, Stack } from "@mui/material";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import { defaultReceiptCreateValues } from "@/features/inbound/model/mappers";
import { inboundApi } from "@/features/inbound/model/api";
import type { PurchaseOrderRecord, ReceiptCreateValues } from "@/features/inbound/model/types";
import { receiptCreateSchema } from "@/features/inbound/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import {
  useLocationReferenceOptions,
  usePurchaseOrderReferenceOptions,
  useWarehouseReferenceOptions,
} from "@/shared/hooks/use-reference-options";
import { useResource } from "@/shared/hooks/use-resource";
import type { ReferenceOption } from "@/shared/types/options";

const stockStatusOptions: ReferenceOption<string>[] = [
  { value: "AVAILABLE", label: "Available", record: "AVAILABLE" },
  { value: "QUARANTINE", label: "Quarantine", record: "QUARANTINE" },
  { value: "DAMAGED", label: "Damaged", record: "DAMAGED" },
];

const emptyLine = {
  purchase_order_line: 0,
  received_qty: 0,
  stock_status: "AVAILABLE",
  lot_number: "",
  serial_number: "",
  unit_cost: 0,
};

interface CreateReceiptPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: ReceiptCreateValues) => Promise<unknown> | void;
  successMessage?: string | null;
}

export function CreateReceiptPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: CreateReceiptPanelProps) {
  const { t, msg } = useI18n();
  const form = useForm<ReceiptCreateValues>({
    defaultValues: defaultReceiptCreateValues,
    resolver: zodResolver(receiptCreateSchema),
  });
  const { control, reset, setValue, watch } = form;
  const selectedWarehouseId = watch("warehouse") || undefined;
  const selectedPurchaseOrderId = watch("purchase_order") || undefined;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const warehouses = useWarehouseReferenceOptions();
  const purchaseOrders = usePurchaseOrderReferenceOptions(selectedWarehouseId);
  const locations = useLocationReferenceOptions(selectedWarehouseId);
  const purchaseOrderQuery = useResource<PurchaseOrderRecord>(
    ["inbound", "purchase-orders", "reference", selectedPurchaseOrderId],
    `${inboundApi.purchaseOrders}${selectedPurchaseOrderId}/`,
    undefined,
    { enabled: Boolean(selectedPurchaseOrderId) },
  );

  useEffect(() => {
    const selectedPurchaseOrder = purchaseOrders.options.find((option) => option.value === selectedPurchaseOrderId)?.record;
    if (selectedPurchaseOrder && selectedPurchaseOrder.warehouse !== selectedWarehouseId) {
      setValue("warehouse", selectedPurchaseOrder.warehouse, { shouldDirty: true });
    }
  }, [purchaseOrders.options, selectedPurchaseOrderId, selectedWarehouseId, setValue]);

  useEffect(() => {
    setValue("line_items", [emptyLine]);
  }, [selectedPurchaseOrderId, setValue]);

  const lineOptions = useMemo(() => {
    return (purchaseOrderQuery.data?.lines ?? []).map((line) => ({
      value: line.id,
      label: t("Line {{index}} · {{goodsCode}}", { goodsCode: line.goods_code, index: line.line_number }),
      description: t("{{ordered}} ordered · {{received}} received", { ordered: line.ordered_qty, received: line.received_qty }),
      record: line,
    }));
  }, [purchaseOrderQuery.data?.lines, t]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    reset(defaultReceiptCreateValues);
  });

  return (
    <MutationCard
      description="Create warehouse receipts from purchase-order selectors instead of manually entering backend ids."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create receipt"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Purchase order" name="purchase_order" reference={purchaseOrders} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Receipt location" name="receipt_location" reference={locations} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Receipt number" name="receipt_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Notes" name="notes" />
            </Grid>
          </Grid>
          <Divider />
          <Stack spacing={1.5}>
            {fields.map((field, index) => (
              <Grid container spacing={1.5} key={field.id}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormAutocomplete
                    label={msg("PO line {{index}}", { index: index + 1 })}
                    name={`line_items.${index}.purchase_order_line`}
                    options={lineOptions}
                    loading={purchaseOrderQuery.isLoading}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormTextField label="Received qty" name={`line_items.${index}.received_qty`} type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormTextField label="Unit cost" name={`line_items.${index}.unit_cost`} type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormAutocomplete
                    label="Stock status"
                    name={`line_items.${index}.stock_status`}
                    options={stockStatusOptions}
                  />
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
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormTextField label="Lot number" name={`line_items.${index}.lot_number`} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormTextField label="Serial number" name={`line_items.${index}.serial_number`} />
                </Grid>
              </Grid>
            ))}
            <Button onClick={() => append(emptyLine)} startIcon={<AddOutlined />} type="button" variant="text">
              Add line
            </Button>
          </Stack>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create receipt"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
