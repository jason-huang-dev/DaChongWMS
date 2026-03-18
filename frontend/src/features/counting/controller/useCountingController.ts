import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runApprovalDecision,
  runScannerAck,
  runScannerComplete,
  runScannerStart,
} from "@/features/counting/controller/actions";
import { countingApi } from "@/features/counting/model/api";
import type {
  ApprovalDecisionAction,
  ApprovalDecisionValues,
  CountApprovalQueueRecord,
  CountApprovalRecord,
  CountingDashboardSummary,
  CycleCountLineRecord,
  NextCountTaskRecord,
  ScannerCompleteValues,
} from "@/features/counting/model/types";
import { defaultApprovalDecisionValues } from "@/features/counting/model/mappers";
import { useDataView } from "@/shared/hooks/use-data-view";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { executeBulkAction } from "@/shared/lib/bulk-actions";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateCountingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["counting"], ["dashboard"], ["inventory"]]);
}

export function useCountingController() {
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const queueSelection = useBulkSelection<number>();
  const queryClient = useQueryClient();
  const [bulkActionSuccessMessage, setBulkActionSuccessMessage] = useState<string | null>(null);
  const [bulkActionErrorMessage, setBulkActionErrorMessage] = useState<string | null>(null);
  const [bulkDecisionNotes, setBulkDecisionNotes] = useState("");
  const assignmentsView = useDataView({
    viewKey: `counting.assignments.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      scanner_task_type: "",
      scanner_task_status: "",
    },
    pageSize: 10,
  });
  const queueView = useDataView({
    viewKey: `counting.approvals.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: "",
      requested_by__icontains: "",
    },
    pageSize: 10,
  });

  const bulkDecisionMutation = useMutation({
    mutationFn: async ({
      action,
      approvalIds,
      notes,
    }: {
      action: ApprovalDecisionAction;
      approvalIds: number[];
      notes: string;
    }) =>
      executeBulkAction(approvalIds, (approvalId) =>
        runApprovalDecision(String(approvalId), action, { notes }),
      ),
    onSuccess: async (result, variables) => {
      if (result.successCount > 0) {
        setBulkActionSuccessMessage(
          `${variables.action === "approve" ? "Approved" : "Rejected"} ${result.successCount} count approval${result.successCount === 1 ? "" : "s"}.`,
        );
      } else {
        setBulkActionSuccessMessage(null);
      }
      setBulkActionErrorMessage(
        result.failures.length > 0
          ? `Failed ${result.failures.length} approval${result.failures.length === 1 ? "" : "s"}: ${result.failures
              .slice(0, 3)
              .map((failure) => `#${failure.item} ${failure.message}`)
              .join("; ")}`
          : null,
      );
      setBulkDecisionNotes("");
      queueSelection.clearSelection();
      await invalidateCountingQueries(queryClient);
    },
    onError: (error) => {
      setBulkActionSuccessMessage(null);
      setBulkActionErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    assignmentsView,
    assignmentsQuery: usePaginatedResource<CycleCountLineRecord>(
      ["counting", "my-assignments"],
      countingApi.myAssignments,
      assignmentsView.page,
      assignmentsView.pageSize,
      {
        ...assignmentsView.queryFilters,
      },
    ),
    nextTaskQuery: useResource<NextCountTaskRecord>(["counting", "next-task"], countingApi.nextTask),
    dashboardQuery: useResource<CountingDashboardSummary>(
      ["counting", "dashboard"],
      countingApi.approvalsDashboard,
      {
        warehouse: activeWarehouseId ?? undefined,
      },
    ),
    bulkActionErrorMessage,
    bulkActionSuccessMessage,
    bulkDecisionNotes,
    bulkDecisionMutation,
    setBulkDecisionNotes,
    queueView,
    queueSelection,
    queueQuery: usePaginatedResource<CountApprovalQueueRecord>(
      ["counting", "approval-queue"],
      countingApi.approvalsQueue,
      queueView.page,
      queueView.pageSize,
      {
        ...queueView.queryFilters,
      },
    ),
  };
}

export function useCountApprovalDetailController(approvalId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const approvalQuery = useResource<CountApprovalRecord>(
    ["counting", "approvals", approvalId],
    `${countingApi.approvals}${approvalId}/`,
    undefined,
    { enabled: Boolean(approvalId) },
  );

  const lineId = approvalQuery.data?.cycle_count_line;
  const lineQuery = useResource<CycleCountLineRecord>(
    ["counting", "cycle-count-lines", lineId],
    `${countingApi.cycleCountLines}${lineId}/`,
    undefined,
    { enabled: Boolean(lineId) },
  );

  const decisionMutation = useMutation({
    mutationFn: ({ action, values }: { action: ApprovalDecisionAction; values: ApprovalDecisionValues }) =>
      runApprovalDecision(String(approvalId), action, values),
    onSuccess: async (approval) => {
      setErrorMessage(null);
      setSuccessMessage(
        `Approval ${approval.count_number}-${approval.line_number} is now ${approval.status.toLowerCase()}.`,
      );
      await invalidateCountingQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    approvalQuery,
    lineQuery,
    decisionMutation,
    successMessage,
    errorMessage,
    defaultValues: defaultApprovalDecisionValues,
  };
}

export function useScannerTaskController(taskId: number | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ackMutation = useMutation({
    mutationFn: () => runScannerAck(Number(taskId)),
    onSuccess: async (line) => {
      setErrorMessage(null);
      setSuccessMessage(`Scanner task acknowledged for ${line.goods_code}.`);
      await invalidateCountingQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const startMutation = useMutation({
    mutationFn: () => runScannerStart(Number(taskId)),
    onSuccess: async (line) => {
      setErrorMessage(null);
      setSuccessMessage(`Scanner task started at ${line.location_code}.`);
      await invalidateCountingQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (values: ScannerCompleteValues) => runScannerComplete(Number(taskId), values),
    onSuccess: async (line) => {
      setErrorMessage(null);
      setSuccessMessage(
        `Scanner task completed with counted quantity ${formatNumber(line.counted_qty ?? "0")}.`,
      );
      await invalidateCountingQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    ackMutation,
    startMutation,
    completeMutation,
    successMessage,
    errorMessage,
  };
}
