import { Chip } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { getStatusLabelKey } from "@/shared/i18n/system-labels";
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
  const { translate } = useI18n();
  const labelKey = getStatusLabelKey(status);

  return (
    <Chip
      color={colorMap[key] ?? "default"}
      label={labelKey ? translate(labelKey) : formatStatusLabel(status)}
      size="small"
      variant="outlined"
    />
  );
}
