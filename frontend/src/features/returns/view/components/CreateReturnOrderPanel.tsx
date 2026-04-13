import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import { Button, Divider, Grid, IconButton, Stack } from "@mui/material";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import { defaultReturnOrderCreateValues } from "@/features/returns/model/mappers";
import type { ReturnOrderCreateValues, SalesOrderRecord } from "@/features/returns/model/types";
import { returnOrderCreateSchema } from "@/features/returns/model/validators";
import { outboundApi } from "@/features/outbound/model/api";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { useSalesOrderReferenceOptions, useWarehouseReferenceOptions } from "@/shared/hooks/use-reference-options";
import { useResource } from "@/shared/hooks/use-resource";

const emptyLine = {
  sales_order_line: 0,
  expected_qty: 0,
  return_reason: "",
  notes: "",
};

interface CreateReturnOrderPanelProps {
  errorMessage?: string | null;
  isPending: boolean;
  onSubmit: (values: ReturnOrderCreateValues, salesOrder: SalesOrderRecord) => Promise<unknown> | void;
  successMessage?: string | null;
}

export function CreateReturnOrderPanel({
  errorMessage,
  isPending,
  onSubmit,
  successMessage,
}: CreateReturnOrderPanelProps) {
  const { t, msg } = useI18n();
  const form = useForm<ReturnOrderCreateValues>({
    defaultValues: defaultReturnOrderCreateValues,
    resolver: zodResolver(returnOrderCreateSchema),
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
  const salesOrderQuery = useResource<SalesOrderRecord>(
    ["returns", "sales-order-reference", selectedSalesOrderId],
    `${outboundApi.salesOrders}${selectedSalesOrderId}/`,
    undefined,
    { enabled: Boolean(selectedSalesOrderId) },
  );

  useEffect(() => {
    const selectedSalesOrder = salesOrders.options.find((option) => option.value === selectedSalesOrderId)?.record;
    if (selectedSalesOrder && selectedSalesOrder.warehouse !== selectedWarehouseId) {
      setValue("warehouse", selectedSalesOrder.warehouse, { shouldDirty: true });
    }
  }, [salesOrders.options, selectedSalesOrderId, selectedWarehouseId, setValue]);

  useEffect(() => {
    setValue("line_items", [emptyLine]);
  }, [selectedSalesOrderId, setValue]);

  const lineOptions = useMemo(() => {
    return (salesOrderQuery.data?.lines ?? []).map((line) => ({
      value: line.id,
      label: t("Line {{index}} · {{goodsCode}}", { goodsCode: line.goods_code, index: line.line_number }),
      description: t("{{ordered}} ordered · {{shipped}} shipped", { ordered: line.ordered_qty, shipped: line.shipped_qty }),
      record: line,
    }));
  }, [salesOrderQuery.data?.lines, t]);

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!salesOrderQuery.data) {
      return;
    }
    await onSubmit(values, salesOrderQuery.data);
    reset(defaultReturnOrderCreateValues);
  });

  return (
    <MutationCard
      description="Create return orders from warehouse and sales-order selectors so the backend customer and SKU relationships stay consistent."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create return order"
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
              <FormTextField label="Return number" name="return_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField InputLabelProps={{ shrink: true }} label="Requested date" name="requested_date" type="datetime-local" />
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
                <Grid size={{ xs: 12, md: 5 }}>
                  <FormAutocomplete
                    label={msg("Sales order line {{index}}", { index: index + 1 })}
                    name={`line_items.${index}.sales_order_line`}
                    options={lineOptions}
                    loading={salesOrderQuery.isLoading}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <FormTextField label="Expected qty" name={`line_items.${index}.expected_qty`} type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormTextField label="Return reason" name={`line_items.${index}.return_reason`} />
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
                <Grid size={{ xs: 12 }}>
                  <FormTextField label="Line notes" name={`line_items.${index}.notes`} />
                </Grid>
              </Grid>
            ))}
            <Button onClick={() => append(emptyLine)} startIcon={<AddOutlined />} type="button" variant="text">
              Add line
            </Button>
          </Stack>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create return order"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
