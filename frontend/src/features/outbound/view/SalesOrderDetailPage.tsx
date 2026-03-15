import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useSalesOrderDetailController } from "@/features/outbound/controller/useOutboundController";
import type { SalesOrderEditValues } from "@/features/outbound/model/types";
import { salesOrderEditSchema } from "@/features/outbound/model/validators";
import { DocumentHeaderFields } from "@/shared/components/document-header-fields";
import { MutationCard } from "@/shared/components/mutation-card";
import { RouteFallback } from "@/shared/components/route-fallback";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { SummaryCard } from "@/shared/components/summary-card";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function SalesOrderDetailPage() {
  const { salesOrderId } = useParams<{ salesOrderId: string }>();
  const { salesOrderQuery, updateMutation, allocateMutation, cancelMutation, successMessage, errorMessage, defaultValues } =
    useSalesOrderDetailController(salesOrderId);

  const form = useForm<SalesOrderEditValues>({
    defaultValues: defaultValues,
    resolver: zodResolver(salesOrderEditSchema),
  });

  useEffect(() => {
    if (!salesOrderQuery.data) {
      return;
    }
    form.reset(defaultValues);
  }, [defaultValues, form, salesOrderQuery.data]);

  const summaryItems = useMemo(() => {
    if (!salesOrderQuery.data) {
      return [];
    }
    const salesOrder = salesOrderQuery.data;
    return [
      { label: "Order number", value: salesOrder.order_number },
      { label: "Warehouse", value: salesOrder.warehouse_name },
      { label: "Customer", value: salesOrder.customer_name },
      { label: "Staging location", value: salesOrder.staging_location_code },
      { label: "Status", value: <StatusChip status={salesOrder.status} /> },
      { label: "Requested ship date", value: formatDateTime(salesOrder.requested_ship_date) },
      { label: "Reference", value: salesOrder.reference_code || "--" },
      { label: "Updated", value: formatDateTime(salesOrder.update_time) },
    ];
  }, [salesOrderQuery.data]);

  if (!salesOrderId) {
    return <Navigate replace to="/outbound" />;
  }

  if (salesOrderQuery.isLoading) {
    return <RouteFallback />;
  }

  const salesOrder = salesOrderQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button component={RouterLink} to="/outbound" variant="outlined">
            Back to outbound
          </Button>
        }
        description="Review line allocation demand, update editable header fields, allocate work, or cancel the order before shipping."
        title="Sales order detail"
      />
      <QueryAlert message={salesOrderQuery.error ? parseApiError(salesOrderQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {!salesOrder ? null : (
        <>
          <SummaryCard
            description="Current outbound order state returned by the backend."
            items={summaryItems}
            title="Order summary"
          />
          <MutationCard
            description="Header edits stay limited to fields the backend allows operators to change directly."
            successMessage={successMessage}
            title="Edit and action flow"
          >
            <FormProvider {...form}>
              <Stack
                component="form"
                noValidate
                onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
                spacing={2}
              >
                <DocumentHeaderFields
                  dateLabel="Requested ship date"
                  dateName="requested_ship_date"
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button disabled={updateMutation.isPending} type="submit" variant="contained">
                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    disabled={allocateMutation.isPending || ["ALLOCATED", "PICKING", "PICKED", "SHIPPED", "CANCELLED"].includes(salesOrder.status)}
                    onClick={() => allocateMutation.mutate()}
                    type="button"
                    variant="outlined"
                  >
                    {allocateMutation.isPending ? "Allocating..." : "Allocate order"}
                  </Button>
                  <Button
                    color="error"
                    disabled={cancelMutation.isPending || ["SHIPPED", "CANCELLED"].includes(salesOrder.status)}
                    onClick={() => cancelMutation.mutate()}
                    type="button"
                    variant="outlined"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel order"}
                  </Button>
                </Stack>
              </Stack>
            </FormProvider>
          </MutationCard>
          <ResourceTable
            columns={[
              { header: "Line", key: "line", render: (row) => row.line_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Ordered", key: "ordered", align: "right", render: (row) => formatNumber(row.ordered_qty) },
              { header: "Allocated", key: "allocated", align: "right", render: (row) => formatNumber(row.allocated_qty) },
              { header: "Picked", key: "picked", align: "right", render: (row) => formatNumber(row.picked_qty) },
              { header: "Shipped", key: "shipped", align: "right", render: (row) => formatNumber(row.shipped_qty) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            getRowId={(row) => row.id}
            rows={salesOrder.lines}
            subtitle="Line quantities stay backend-owned; this view keeps operators focused on the order header and execution actions."
            title="Order lines"
          />
        </>
      )}
    </Stack>
  );
}
