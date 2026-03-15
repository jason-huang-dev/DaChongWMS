import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { useForm } from "react-hook-form";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useTransferOrderDetailController } from "@/features/transfers/controller/useTransfersController";
import type { TransferOrderEditValues } from "@/features/transfers/model/types";
import { transferOrderEditSchema } from "@/features/transfers/model/validators";
import { TransferOrderForm } from "@/features/transfers/view/TransferOrderForm";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { ResourceTable } from "@/shared/components/resource-table";
import { RouteFallback } from "@/shared/components/route-fallback";
import { StatusChip } from "@/shared/components/status-chip";
import { SummaryCard } from "@/shared/components/summary-card";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function TransferOrderDetailPage() {
  const { transferOrderId } = useParams<{ transferOrderId: string }>();
  const {
    archiveMutation,
    completeLineMutation,
    defaultValues,
    errorMessage,
    successMessage,
    transferOrderQuery,
    updateMutation,
  } = useTransferOrderDetailController(transferOrderId);

  const form = useForm<TransferOrderEditValues>({
    defaultValues,
    resolver: zodResolver(transferOrderEditSchema),
  });

  useEffect(() => {
    if (!transferOrderQuery.data) {
      return;
    }
    form.reset(defaultValues);
  }, [defaultValues, form, transferOrderQuery.data]);

  const summaryItems = useMemo(() => {
    if (!transferOrderQuery.data) {
      return [];
    }
    const transferOrder = transferOrderQuery.data;
    return [
      { label: "Transfer number", value: transferOrder.transfer_number },
      { label: "Warehouse", value: transferOrder.warehouse_name },
      { label: "Requested date", value: formatDateTime(transferOrder.requested_date) },
      { label: "Status", value: <StatusChip status={transferOrder.status} /> },
      { label: "Reference", value: transferOrder.reference_code || "--" },
      { label: "Created", value: formatDateTime(transferOrder.create_time) },
      { label: "Updated", value: formatDateTime(transferOrder.update_time) },
    ];
  }, [transferOrderQuery.data]);

  if (!transferOrderId) {
    return <Navigate replace to="/transfers" />;
  }

  if (transferOrderQuery.isLoading) {
    return <RouteFallback />;
  }

  const transferOrder = transferOrderQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button component={RouterLink} to="/transfers" variant="outlined">
            Back to transfers
          </Button>
        }
        description="Review transfer demand, update the editable header fields, archive the order, and complete outstanding transfer lines."
        title="Transfer order detail"
      />
      <QueryAlert message={transferOrderQuery.error ? parseApiError(transferOrderQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {!transferOrder ? null : (
        <>
          <SummaryCard
            description="Current transfer order state returned by the transfer API."
            items={summaryItems}
            title="Transfer order summary"
          />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12 }}>
              <TransferOrderForm
                canArchive={transferOrder.status !== "COMPLETED"}
                form={form}
                isArchiving={archiveMutation.isPending}
                isSubmitting={updateMutation.isPending}
                onArchive={() => archiveMutation.mutate()}
                onSubmit={(values) => updateMutation.mutate(values)}
                successMessage={successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ResourceTable
                columns={[
                  { header: "Line", key: "line", render: (row) => row.line_number },
                  { header: "SKU", key: "sku", render: (row) => row.goods_code },
                  { header: "From", key: "from", render: (row) => row.from_location_code },
                  { header: "To", key: "to", render: (row) => row.to_location_code },
                  { header: "Requested", key: "requested", align: "right", render: (row) => formatNumber(row.requested_qty) },
                  { header: "Moved", key: "moved", align: "right", render: (row) => formatNumber(row.moved_qty) },
                  { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
                  {
                    header: "Action",
                    key: "action",
                    render: (row) => (
                      <Button
                        disabled={completeLineMutation.isPending || row.status === "COMPLETED"}
                        onClick={() => completeLineMutation.mutate(row.id)}
                        size="small"
                        variant="contained"
                      >
                        Complete
                      </Button>
                    ),
                  },
                ]}
                getRowId={(row) => row.id}
                rows={transferOrder.lines}
                subtitle="Transfer lines execute the actual inventory movement between locations."
                title="Transfer lines"
              />
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
