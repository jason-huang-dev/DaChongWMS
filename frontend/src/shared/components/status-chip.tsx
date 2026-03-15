import { Chip } from "@mui/material";

import { formatStatusLabel } from "@/shared/utils/format";

const colorMap: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "error"> = {
  open: "primary",
  draft: "secondary",
  received: "success",
  completed: "success",
  reconciled: "success",
  approved: "success",
  auto_approved: "success",
  finalized: "primary",
  remitted: "success",
  issued: "primary",
  pending: "warning",
  pending_approval: "warning",
  partially_remitted: "warning",
  under_review: "warning",
  rejected: "error",
  cancelled: "error",
  blocked: "error",
  shipped: "success",
  picked: "success",
  void: "error",
};

export function StatusChip({ status }: { status?: string | null }) {
  const key = status?.toLowerCase() ?? "";
  return <Chip color={colorMap[key] ?? "default"} label={formatStatusLabel(status)} size="small" variant="outlined" />;
}
