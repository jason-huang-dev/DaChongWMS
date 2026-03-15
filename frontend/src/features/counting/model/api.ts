import { apiPost } from "@/lib/http";

import type {
  ApprovalDecisionAction,
  ApprovalDecisionValues,
  CountApprovalRecord,
  ScannerCompleteValues,
  CycleCountLineRecord,
} from "./types";

export const countingApi = {
  approvals: "/api/counting/approvals/",
  approvalsDashboard: "/api/counting/approvals/dashboard/",
  approvalsQueue: "/api/counting/approvals/queue/",
  cycleCountLines: "/api/counting/cycle-count-lines/",
  myAssignments: "/api/counting/cycle-count-lines/my-assignments/",
  nextTask: "/api/counting/cycle-count-lines/next-task/",
};

export function postApprovalDecision(
  approvalId: string,
  action: ApprovalDecisionAction,
  values: ApprovalDecisionValues,
) {
  return apiPost<CountApprovalRecord>(`${countingApi.approvals}${approvalId}/${action}/`, values);
}

export function postScannerAck(taskId: number) {
  return apiPost<CycleCountLineRecord>(`${countingApi.cycleCountLines}${taskId}/scanner-ack/`);
}

export function postScannerStart(taskId: number) {
  return apiPost<CycleCountLineRecord>(`${countingApi.cycleCountLines}${taskId}/scanner-start/`);
}

export function postScannerComplete(taskId: number, values: ScannerCompleteValues) {
  return apiPost<CycleCountLineRecord>(`${countingApi.cycleCountLines}${taskId}/scanner-complete/`, values);
}
