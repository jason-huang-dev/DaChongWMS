import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { usePurchaseOrderDetailController } from "@/features/inbound/controller/useInboundController";
import { purchaseOrderEditSchema } from "@/features/inbound/model/validators";
import type { PurchaseOrderEditValues } from "@/features/inbound/model/types";
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

export function PurchaseOrderDetailPage() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const { purchaseOrderQuery, updateMutation, cancelMutation, successMessage, errorMessage, defaultValues } =
    usePurchaseOrderDetailController(purchaseOrderId);

  const form = useForm<PurchaseOrderEditValues>({
    defaultValues: defaultValues,
    resolver: zodResolver(purchaseOrderEditSchema),
  });

  useEffect(() => {
    if (!purchaseOrderQuery.data) {
      return;
    }
    form.reset(defaultValues);
  }, [defaultValues, form, purchaseOrderQuery.data]);

  const summaryItems = useMemo(() => {
    if (!purchaseOrderQuery.data) {
      return [];
    }
    const purchaseOrder = purchaseOrderQuery.data;
    return [
      { label: "PO number", value: purchaseOrder.po_number },
      { label: "Warehouse", value: purchaseOrder.warehouse_name },
      { label: "Supplier", value: purchaseOrder.supplier_name },
      { label: "Status", value: <StatusChip status={purchaseOrder.status} /> },
      { label: "Expected arrival", value: formatDateTime(purchaseOrder.expected_arrival_date) },
      { label: "Reference", value: purchaseOrder.reference_code || "--" },
      { label: "Created", value: formatDateTime(purchaseOrder.create_time) },
      { label: "Updated", value: formatDateTime(purchaseOrder.update_time) },
    ];
  }, [purchaseOrderQuery.data]);

  if (!purchaseOrderId) {
    return <Navigate replace to="/inbound/standard-stock-in" />;
  }

  if (purchaseOrderQuery.isLoading) {
    return <RouteFallback />;
  }

  const purchaseOrder = purchaseOrderQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button component={RouterLink} to="/inbound/standard-stock-in" variant="outlined">
            Back to inbound
          </Button>
        }
        description="Review line demand, update the editable header fields, or cancel the purchase order before receiving starts."
        title="Purchase order detail"
      />
      <QueryAlert message={purchaseOrderQuery.error ? parseApiError(purchaseOrderQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {!purchaseOrder ? null : (
        <>
          <SummaryCard
            description="Current header state returned by the inbound API."
            items={summaryItems}
            title="Order summary"
          />
          <MutationCard
            description="Only editable header fields are exposed here. Warehouse, supplier, and line items remain backend-owned."
            successMessage={successMessage}
            title="Edit purchase order"
          >
            <FormProvider {...form}>
              <Stack
                component="form"
                noValidate
                onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
                spacing={2}
              >
                <DocumentHeaderFields
                  dateLabel="Expected arrival"
                  dateName="expected_arrival_date"
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button disabled={updateMutation.isPending} type="submit" variant="contained">
                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    color="error"
                    disabled={cancelMutation.isPending || ["CANCELLED", "CLOSED"].includes(purchaseOrder.status)}
                    onClick={() => cancelMutation.mutate()}
                    type="button"
                    variant="outlined"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel purchase order"}
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
              { header: "Received", key: "received", align: "right", render: (row) => formatNumber(row.received_qty) },
              { header: "Unit cost", key: "unitCost", align: "right", render: (row) => formatNumber(row.unit_cost) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            getRowId={(row) => row.id}
            rows={purchaseOrder.lines}
            subtitle="Line items are read-only here because the backend treats line changes as a separate workflow."
            title="Line items"
          />
        </>
      )}
    </Stack>
  );
}
