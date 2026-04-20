import type {
  CountApprovalQueueRecord,
  CountApprovalRecord,
  CountingDashboardSummary,
  CycleCountLineRecord,
  NextCountTaskRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { approvalDecisionSchema, scannerCompleteSchema } from "./validators";

export type {
  CountApprovalQueueRecord,
  CountApprovalRecord,
  CountingDashboardSummary,
  CycleCountLineRecord,
  NextCountTaskRecord,
};

export type ApprovalDecisionAction = "approve" | "reject";
export type ApprovalDecisionValues = z.infer<typeof approvalDecisionSchema>;
export type ScannerCompleteValues = z.infer<typeof scannerCompleteSchema>;
