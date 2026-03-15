import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import { Button, Divider, Grid, IconButton, Stack } from "@mui/material";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import { defaultShipmentCreateValues } from "@/features/outbound/model/mappers";
import { outboundApi } from "@/features/outbound/model/api";
import type { SalesOrderRecord, ShipmentCreateValues } from "@/features/outbound/model/types";
import { shipmentCreateSchema } from "@/features/outbound/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import {
  useLocationReferenceOptions,
  useSalesOrderReferenceOptions,
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
  sales_order_line: 0,
  shipped_qty: 0,
  stock_status: "AVAILABLE",
  lot_number: "",
  serial_number: "",
  from_location: undefined,
};

interface CreateShipmentPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: ShipmentCreateValues) => Promise<unknown> | void;
  successMessage?: string | null;
}

export function CreateShipmentPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: CreateShipmentPanelProps) {
  const form = useForm<ShipmentCreateValues>({
    defaultValues: defaultShipmentCreateValues,
    resolver: zodResolver(shipmentCreateSchema),
  });
  const { control, reset, setValue, watch } = form;
  const selectedWarehouseId = watch("warehouse") || undefined;
  const selectedSalesOrderId = watch("sales_order") || undefined;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const warehouses = useWarehouseReferenceOptions();
  const salesOrders = useSalesOrderReferenceOptions(selectedWarehouseId);
  const locations = useLocationReferenceOptions(selectedWarehouseId);
  const salesOrderQuery = useResource<SalesOrderRecord>(
    ["outbound", "sales-orders", "reference", selectedSalesOrderId],
    `${outboundApi.salesOrders}${selectedSalesOrderId}/`,
    undefined,
    { enabled: Boolean(selectedSalesOrderId) },
  );

  useEffect(() => {
    const selectedSalesOrder = salesOrders.options.find((option) => option.value === selectedSalesOrderId)?.record;
    if (selectedSalesOrder && selectedSalesOrder.warehouse !== selectedWarehouseId) {
      setValue("warehouse", selectedSalesOrder.warehouse, { shouldDirty: true });
    }
    if (selectedSalesOrder && selectedSalesOrder.staging_location) {
      setValue("staging_location", selectedSalesOrder.staging_location, { shouldDirty: true });
    }
  }, [salesOrders.options, selectedSalesOrderId, selectedWarehouseId, setValue]);

  useEffect(() => {
    setValue("line_items", [emptyLine]);
  }, [selectedSalesOrderId, setValue]);

  const lineOptions = useMemo(() => {
    return (salesOrderQuery.data?.lines ?? []).map((line) => ({
      value: line.id,
      label: `Line ${line.line_number} · ${line.goods_code}`,
      description: `${line.ordered_qty} ordered · ${line.allocated_qty} allocated`,
      record: line,
    }));
  }, [salesOrderQuery.data?.lines]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    reset(defaultShipmentCreateValues);
  });

  return (
    <MutationCard
      description="Create outbound shipment confirmations from order, staging, and line selectors instead of raw backend ids."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create shipment"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Sales order" name="sales_order" reference={salesOrders} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Staging location" name="staging_location" reference={locations} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Shipment number" name="shipment_number" />
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
                    label={`Order line ${index + 1}`}
                    name={`line_items.${index}.sales_order_line`}
                    options={lineOptions}
                    loading={salesOrderQuery.isLoading}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormTextField label="Shipped qty" name={`line_items.${index}.shipped_qty`} type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormAutocomplete
                    label="Stock status"
                    name={`line_items.${index}.stock_status`}
                    options={stockStatusOptions}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <ReferenceAutocompleteField
                    label="From location"
                    name={`line_items.${index}.from_location`}
                    reference={locations}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }}>
                  <IconButton
                    aria-label={`remove-shipment-line-${index + 1}`}
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
            {isPending ? "Creating..." : "Create shipment"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
