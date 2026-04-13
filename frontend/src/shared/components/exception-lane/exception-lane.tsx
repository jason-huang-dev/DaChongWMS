import type { ReactNode } from "react";

import { Chip, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { ResourceTable } from "@/shared/components/resource-table";

type Severity = "info" | "warning" | "error";

interface ColumnDefinition<TRow> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: TRow) => ReactNode;
}

interface ExceptionLaneProps<TRow> {
  title: string;
  subtitle: string;
  severity?: Severity;
  rows: TRow[];
  columns: ColumnDefinition<TRow>[];
  getRowId: (row: TRow) => string | number;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  action?: ReactNode;
}

const severityLabel: Record<Severity, string> = {
  info: "Watchlist",
  warning: "Action needed",
  error: "Escalation",
};

export function ExceptionLane<TRow>({
  title,
  subtitle,
  severity = "warning",
  rows,
  columns,
  getRowId,
  isLoading,
  error,
  emptyMessage = "No active exceptions.",
  action,
}: ExceptionLaneProps<TRow>) {
  const { t, translate } = useI18n();

  return (
    <ResourceTable
      columns={columns}
      emptyMessage={emptyMessage}
      error={error}
      getRowId={getRowId}
      isLoading={isLoading}
      rows={rows}
      subtitle={subtitle}
      title={title}
      toolbar={
        <Stack
          alignItems={{ sm: "center" }}
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={1}
        >
          <Stack alignItems={{ sm: "center" }} direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip color={severity} label={translate(severityLabel[severity])} size="small" />
            <Chip label={t("ui.itemsCount", { count: rows.length })} size="small" variant="outlined" />
          </Stack>
          {action}
        </Stack>
      }
    />
  );
}
