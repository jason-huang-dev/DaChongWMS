import type { ApprovalDecisionValues, ScannerCompleteValues } from "./types";

export const defaultApprovalDecisionValues: ApprovalDecisionValues = {
  notes: "",
};

export const defaultScannerCompleteValues: ScannerCompleteValues = {
  counted_qty: 0,
  adjustment_reason_code: "",
  notes: "",
};
