import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Stack } from "@mui/material";
import { useForm } from "react-hook-form";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useReturnOrderDetailController } from "@/features/returns/controller/useReturnsController";
import type { ReturnOrderEditValues } from "@/features/returns/model/types";
import { returnOrderEditSchema } from "@/features/returns/model/validators";
import { ReturnOrderForm } from "@/features/returns/view/ReturnOrderForm";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { ResourceTable } from "@/shared/components/resource-table";
import { RouteFallback } from "@/shared/components/route-fallback";
import { StatusChip } from "@/shared/components/status-chip";
import { SummaryCard } from "@/shared/components/summary-card";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function ReturnOrderDetailPage() {
  const { returnOrderId } = useParams<{ returnOrderId: string }>();
  const {
    archiveMutation,
    defaultValues,
    errorMessage,
    returnOrderQuery,
    successMessage,
    updateMutation,
  } = useReturnOrderDetailController(returnOrderId);

  const form = useForm<ReturnOrderEditValues>({
    defaultValues,
    resolver: zodResolver(returnOrderEditSchema),
  });

  useEffect(() => {
    if (!returnOrderQuery.data) {
      return;
    }
    form.reset(defaultValues);
  }, [defaultValues, form, returnOrderQuery.data]);

  const summaryItems = useMemo(() => {
    if (!returnOrderQuery.data) {
      return [];
    }
    const returnOrder = returnOrderQuery.data;
    return [
      { label: "Return number", value: returnOrder.return_number },
      { label: "Warehouse", value: returnOrder.warehouse_name },
      { label: "Customer", value: returnOrder.customer_name },
      { label: "Sales order", value: returnOrder.sales_order_number || "--" },
      { label: "Requested date", value: formatDateTime(returnOrder.requested_date) },
      { label: "Status", value: <StatusChip status={returnOrder.status} /> },
      { label: "Reference", value: returnOrder.reference_code || "--" },
      { label: "Updated", value: formatDateTime(returnOrder.update_time) },
    ];
  }, [returnOrderQuery.data]);

  if (!returnOrderId) {
    return <Navigate replace to="/returns" />;
  }

  if (returnOrderQuery.isLoading) {
    return <RouteFallback />;
  }

  const returnOrder = returnOrderQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button component={RouterLink} to="/returns" variant="outlined">
            Back to returns
          </Button>
        }
        description="Review the return order header, update editable fields, archive the order, and inspect the line-level expected versus received quantities."
        title="Return order detail"
      />
      <QueryAlert message={returnOrderQuery.error ? parseApiError(returnOrderQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {!returnOrder ? null : (
        <>
          <SummaryCard
            description="Current return order state returned by the returns API."
            items={summaryItems}
            title="Return order summary"
          />
          <ReturnOrderForm
            canArchive={returnOrder.status !== "COMPLETED"}
            form={form}
            isArchiving={archiveMutation.isPending}
            isSubmitting={updateMutation.isPending}
            onArchive={() => archiveMutation.mutate()}
            onSubmit={(values) => updateMutation.mutate(values)}
            successMessage={successMessage}
          />
          <ResourceTable
            columns={[
              { header: "Line", key: "line", render: (row) => row.line_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Expected", key: "expected", align: "right", render: (row) => formatNumber(row.expected_qty) },
              { header: "Received", key: "received", align: "right", render: (row) => formatNumber(row.received_qty) },
              { header: "Disposed", key: "disposed", align: "right", render: (row) => formatNumber(row.disposed_qty) },
              { header: "Reason", key: "reason", render: (row) => row.return_reason || "--" },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            getRowId={(row) => row.id}
            rows={returnOrder.lines}
            subtitle="Return lines show how much of each SKU has been received and disposed."
            title="Return lines"
          />
        </>
      )}
    </Stack>
  );
}
