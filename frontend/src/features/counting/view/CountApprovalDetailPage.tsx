import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack } from "@mui/material";
import { useForm } from "react-hook-form";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useCountApprovalDetailController } from "@/features/counting/controller/useCountingController";
import type { ApprovalDecisionValues } from "@/features/counting/model/types";
import { approvalDecisionSchema } from "@/features/counting/model/validators";
import { CountingForm } from "@/features/counting/view/CountingForm";
import { RouteFallback } from "@/shared/components/route-fallback";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function CountApprovalDetailPage() {
  const { approvalId } = useParams<{ approvalId: string }>();
  const { approvalQuery, lineQuery, decisionMutation, successMessage, errorMessage, defaultValues } =
    useCountApprovalDetailController(approvalId);

  const form = useForm<ApprovalDecisionValues>({
    defaultValues,
    resolver: zodResolver(approvalDecisionSchema),
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const approvalItems = useMemo(() => {
    if (!approvalQuery.data) {
      return [];
    }
    const approval = approvalQuery.data;
    return [
      { label: "Count number", value: approval.count_number },
      { label: "Warehouse", value: approval.warehouse_name },
      { label: "Location", value: approval.location_code },
      { label: "SKU", value: approval.goods_code },
      { label: "Variance", value: formatNumber(approval.variance_qty) },
      { label: "Required role", value: approval.required_role },
      { label: "Status", value: <StatusChip status={approval.status} /> },
      { label: "Requested by", value: approval.requested_by },
      { label: "Requested at", value: formatDateTime(approval.requested_at) },
      { label: "Approved by", value: approval.approved_by || "--" },
      { label: "Rejected by", value: approval.rejected_by || "--" },
      { label: "Approval notes", value: approval.notes || "--" },
    ];
  }, [approvalQuery.data]);

  const lineItems = useMemo(() => {
    if (!lineQuery.data) {
      return [];
    }
    const line = lineQuery.data;
    return [
      { label: "Line status", value: <StatusChip status={line.status} /> },
      { label: "Stock status", value: line.stock_status },
      { label: "System qty", value: formatNumber(line.system_qty) },
      { label: "Counted qty", value: formatNumber(line.counted_qty) },
      { label: "Variance qty", value: formatNumber(line.variance_qty) },
      { label: "Adjustment reason", value: line.adjustment_reason_code || "--" },
      { label: "Counted at", value: formatDateTime(line.counted_at) },
      { label: "Recounted at", value: formatDateTime(line.recounted_at) },
      { label: "Notes", value: line.notes || "--" },
    ];
  }, [lineQuery.data]);

  if (!approvalId) {
    return <Navigate replace to="/counting" />;
  }

  if (approvalQuery.isLoading) {
    return <RouteFallback />;
  }

  const approval = approvalQuery.data;
  const canDecide = approval?.status === "PENDING";

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button component={RouterLink} to="/counting" variant="outlined">
            Back to counting
          </Button>
        }
        description="Review the variance context, inspect the underlying count line, and approve or reject the adjustment request."
        title="Variance approval detail"
      />
      <QueryAlert message={approvalQuery.error ? parseApiError(approvalQuery.error) : null} />
      <QueryAlert message={lineQuery.error ? parseApiError(lineQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {!approval ? null : (
        <>
          <DetailCard description="Approval request context pulled from the supervisor queue." title="Approval summary">
            <DetailGrid items={approvalItems} />
          </DetailCard>
          <DetailCard description="Current count-line state. Blind-count redaction still applies if the backend withholds system quantity." title="Count line context">
            {lineQuery.isLoading ? <Alert severity="info">Loading count line context...</Alert> : <DetailGrid items={lineItems} />}
          </DetailCard>
          <DetailCard description="Decision notes are sent directly to the backend approval endpoints." title="Approve or reject">
            <CountingForm
              canDecide={canDecide}
              form={form}
              isSubmitting={decisionMutation.isPending}
              onApprove={form.handleSubmit((values) => decisionMutation.mutate({ action: "approve", values }))}
              onReject={form.handleSubmit((values) => decisionMutation.mutate({ action: "reject", values }))}
              successMessage={successMessage}
            />
          </DetailCard>
        </>
      )}
    </Stack>
  );
}
