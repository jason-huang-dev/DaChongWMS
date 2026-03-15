import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const pageSize = 10;

async function invalidateCountingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["counting"], ["dashboard"], ["inventory"]]);
}

export function useCountingController() {
  const [queuePage, setQueuePage] = useState(1);

  return {
    queuePage,
    setQueuePage,
    pageSize,
    assignmentsQuery: usePaginatedResource<CycleCountLineRecord>(
      ["counting", "my-assignments"],
      countingApi.myAssignments,
      1,
      pageSize,
    ),
    nextTaskQuery: useResource<NextCountTaskRecord>(["counting", "next-task"], countingApi.nextTask),
    dashboardQuery: useResource<CountingDashboardSummary>(
      ["counting", "dashboard"],
      countingApi.approvalsDashboard,
    ),
    queueQuery: usePaginatedResource<CountApprovalQueueRecord>(
      ["counting", "approval-queue"],
      countingApi.approvalsQueue,
      queuePage,
      pageSize,
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
