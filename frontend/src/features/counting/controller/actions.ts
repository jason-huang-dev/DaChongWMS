import { postApprovalDecision, postScannerAck, postScannerComplete, postScannerStart } from "@/features/counting/model/api";

import type { ApprovalDecisionAction, ApprovalDecisionValues, ScannerCompleteValues } from "@/features/counting/model/types";

export function runApprovalDecision(
  approvalId: string,
  action: ApprovalDecisionAction,
  values: ApprovalDecisionValues,
) {
  return postApprovalDecision(approvalId, action, values);
}

export function runScannerAck(taskId: number) {
  return postScannerAck(taskId);
}

export function runScannerStart(taskId: number) {
  return postScannerStart(taskId);
}

export function runScannerComplete(taskId: number, values: ScannerCompleteValues) {
  return postScannerComplete(taskId, values);
}
