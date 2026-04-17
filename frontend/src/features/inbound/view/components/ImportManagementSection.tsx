import { useMemo, type ReactNode } from "react";

import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";
import type { InboundImportBatchRecord } from "@/features/inbound/model/types";
import { DataViewSavedViewControls } from "@/shared/components/data-view-saved-view-controls";
import { DataTable, type DataTableColumnDefinition } from "@/shared/components/data-table";
import { FilterCard } from "@/shared/components/filter-card";
import { StatusChip } from "@/shared/components/status-chip";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface ImportBatchFilters {
  batch_number__icontains: string;
  status: string;
}

interface ImportBatchWorkspaceTableProps {
  importBatchesQuery: PaginatedQueryState<InboundImportBatchRecord>;
  importBatchesView: UseDataViewResult<ImportBatchFilters>;
  title: string;
  toolbarActions?: ReactNode;
  chromeTestId?: string;
}

interface ImportManagementSectionProps {
  importBatchesQuery: PaginatedQueryState<InboundImportBatchRecord>;
  importBatchesView: UseDataViewResult<ImportBatchFilters>;
  onStartImport?: () => void;
}

const importStatusOptions = [
  { label: "All", value: "" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Completed with errors", value: "COMPLETED_WITH_ERRORS" },
  { label: "Failed", value: "FAILED" },
] as const;

function ImportBatchMetaField({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" sx={{ flex: "0 0 auto", fontSize: 12, fontWeight: 600 }} variant="caption">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 500, minWidth: 0 }} variant="body2">
        {value}
      </Typography>
    </Stack>
  );
}

function buildImportManagementColumns(
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
): Array<DataTableColumnDefinition<InboundImportBatchRecord>> {
  return [
    {
      header: t("Import list no."),
      key: "batch",
      minWidth: 236,
      sticky: "left",
      width: 248,
      render: (row) => (
        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} variant="body2">
            {row.batch_number}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }} variant="body2">
            {row.file_name || "--"}
          </Typography>
        </Stack>
      ),
    },
    {
      header: t("Status"),
      key: "status",
      minWidth: 156,
      width: 164,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      header: t("Imported by"),
      key: "importedBy",
      minWidth: 148,
      width: 156,
      render: (row) => row.imported_by || row.creator || "--",
    },
    {
      align: "right",
      header: t("Rows"),
      key: "rows",
      minWidth: 92,
      width: 92,
      render: (row) => formatNumber(row.total_rows),
    },
    {
      align: "right",
      header: t("Success"),
      key: "success",
      minWidth: 96,
      width: 96,
      render: (row) => formatNumber(row.success_rows),
    },
    {
      align: "right",
      header: t("Failed"),
      key: "failed",
      minWidth: 96,
      width: 96,
      render: (row) => (
        <Typography color={row.failed_rows > 0 ? "warning.main" : "text.primary"} fontWeight={row.failed_rows > 0 ? 700 : 500}>
          {formatNumber(row.failed_rows)}
        </Typography>
      ),
    },
    {
      align: "right",
      header: t("Success rate"),
      key: "successRate",
      minWidth: 112,
      width: 112,
      render: (row) => {
        const rate = row.total_rows > 0 ? Math.round((row.success_rows / row.total_rows) * 100) : 0;
        return `${formatNumber(rate)}%`;
      },
    },
    {
      header: t("Imported time"),
      key: "importedAt",
      minWidth: 160,
      width: 172,
      render: (row) => formatDateTime(row.imported_at || row.create_time),
    },
  ];
}

function ImportManagementFilters({
  activeFilterCount,
  dataView,
  failedRowsInView,
  rowsInView,
  totalRowsInView,
  title,
}: {
  activeFilterCount: number;
  dataView: UseDataViewResult<ImportBatchFilters>;
  failedRowsInView: number;
  rowsInView: number;
  totalRowsInView: number;
  title: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate } = useI18n();
  const compoundFieldSx = {
    "& .MuiInputBase-input": {
      fontSize: theme.typography.pxToRem(13),
      py: 0.75,
    },
    "& .MuiOutlinedInput-root": {
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.48 : 0.96),
      borderRadius: 999,
      height: 34,
      minHeight: 34,
    },
  } as const;

  return (
    <FilterCard
      contentSx={{
        pb: "16px !important",
        pt: 1.5,
      }}
      header={
        <Stack spacing={1}>
          <Typography sx={{ fontSize: theme.typography.pxToRem(12), fontWeight: 700, letterSpacing: "0.12em" }} variant="overline">
            {title}
          </Typography>
          <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
            <Chip label={t("Tenant-wide imports")} size="small" variant="outlined" />
            <Chip label={t("filters.activeCount", { count: activeFilterCount })} size="small" variant="outlined" />
            <Chip label={t("import.batchesInView", { count: formatNumber(rowsInView) })} size="small" variant="outlined" />
            <Chip label={t("import.rowsInView", { count: formatNumber(totalRowsInView) })} size="small" variant="outlined" />
            <Chip
              color={failedRowsInView > 0 ? "warning" : "default"}
              label={
                failedRowsInView > 0
                  ? t("import.failedRowsInView", { count: formatNumber(failedRowsInView) })
                  : t("import.noFailedRowsInView")
              }
              size="small"
              variant="outlined"
            />
          </Stack>
        </Stack>
      }
      showDivider={false}
    >
      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            lg: "minmax(0, 1fr) minmax(220px, 0.52fr) auto",
            xs: "minmax(0, 1fr)",
          },
          minWidth: 0,
        }}
      >
        <TextField
          hiddenLabel
          onChange={(event) => dataView.updateFilter("batch_number__icontains", event.target.value)}
          placeholder={translate("Search import batch")}
          size="small"
          value={dataView.filters.batch_number__icontains ?? ""}
          slotProps={{
            htmlInput: {
              "aria-label": t("Search import batch"),
              autoCapitalize: "none",
              autoCorrect: "off",
              spellCheck: false,
            },
          }}
          sx={compoundFieldSx}
        />
        <TextField
          hiddenLabel
          onChange={(event) => dataView.updateFilter("status", event.target.value)}
          select
          size="small"
          value={dataView.filters.status ?? ""}
          slotProps={{
            htmlInput: {
              "aria-label": t("Import status"),
            },
          }}
          sx={compoundFieldSx}
        >
          {importStatusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {translate(option.label)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          color="inherit"
          onClick={dataView.resetFilters}
          size="small"
          sx={{
            alignSelf: { lg: "center", xs: "stretch" },
            minHeight: 44,
            px: 2,
            whiteSpace: "nowrap",
          }}
          variant="outlined"
        >
          {t("Reset")}
        </Button>
      </Box>
    </FilterCard>
  );
}

function ImportManagementTableToolbar({
  dataView,
  failedRowsInView,
  total,
  toolbarActions,
}: {
  dataView: UseDataViewResult<ImportBatchFilters>;
  failedRowsInView: number;
  total: number;
  toolbarActions?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <Stack
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      spacing={0.75}
      sx={{ minWidth: 0 }}
    >
      <Stack
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        spacing={0.75}
        sx={{ flex: "1 1 auto", minWidth: 0 }}
      >
        <Typography color="text.secondary" variant="body2">
          {t("filters.resultCount", { count: total })}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {failedRowsInView > 0
            ? t("import.visibleRowsNeedAttention", { count: formatNumber(failedRowsInView) })
            : t("import.visibleBatchesCompletedCleanly")}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <DataViewSavedViewControls
          onApplySavedView={dataView.applySavedView}
          onDeleteSavedView={dataView.deleteSavedView}
          onSaveSavedView={dataView.saveCurrentView}
          savedViews={dataView.savedViews}
          selectedSavedViewId={dataView.selectedSavedViewId}
        />
        {toolbarActions}
      </Stack>
    </Stack>
  );
}

export function ImportBatchWorkspaceTable({
  chromeTestId = "import-batch-workspace-table-chrome",
  importBatchesQuery,
  importBatchesView,
  title,
  toolbarActions,
}: ImportBatchWorkspaceTableProps) {
  const { t } = useI18n();
  const columns = useMemo(() => buildImportManagementColumns(t), [t]);
  const pageChrome = useCollapsibleTablePageChrome();
  const rows = importBatchesQuery.data?.results ?? [];
  const total = importBatchesQuery.data?.count ?? 0;
  const activeFilterCount = [importBatchesView.filters.batch_number__icontains, importBatchesView.filters.status].filter(Boolean).length;
  const totalRowsInView = rows.reduce((sum, row) => sum + Number(row.total_rows ?? 0), 0);
  const failedRowsInView = rows.reduce((sum, row) => sum + Number(row.failed_rows ?? 0), 0);

  return (
    <StickyTableLayout
      pageChrome={
        <Box
          aria-hidden={pageChrome.isCollapsed}
          data-collapse-progress="0.00"
          data-testid={chromeTestId}
          ref={pageChrome.wrapperRef}
          sx={pageChrome.wrapperSx}
        >
          <Box ref={pageChrome.contentRef}>
            <ImportManagementFilters
              activeFilterCount={activeFilterCount}
              dataView={importBatchesView}
              failedRowsInView={failedRowsInView}
              rowsInView={rows.length}
              title={title}
              totalRowsInView={totalRowsInView}
            />
          </Box>
        </Box>
      }
      table={
        <DataTable
          columnVisibility={{
            storageKey: "inbound.import-management.columns",
          }}
          columns={columns}
          emptyMessage={t("No import batches match the current filters.")}
          error={importBatchesQuery.error ? parseApiError(importBatchesQuery.error) : null}
          fillHeight
          getRowId={(row) => row.id}
          isLoading={importBatchesQuery.isLoading}
          onScrollStateChange={pageChrome.handleTableScrollStateChange}
          pagination={{
            page: importBatchesView.page,
            pageSize: importBatchesView.pageSize,
            total,
            onPageChange: importBatchesView.setPage,
          }}
          renderMetaRow={(row) => {
            const summary = row.summary?.trim() || (row.failed_rows > 0 ? `${formatNumber(row.failed_rows)} failed rows recorded.` : "No batch notes.");
            const firstFailure = row.failure_rows?.[0];

            return (
              <Stack
                alignItems={{ md: "center", xs: "flex-start" }}
                direction={{ md: "row", xs: "column" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Stack direction="row" flexWrap="wrap" spacing={3} useFlexGap>
                  <ImportBatchMetaField label={t("Summary")} value={summary} />
                  {firstFailure ? (
                    <ImportBatchMetaField
                      label={t("Top issue")}
                      value={`Row ${formatNumber(firstFailure.row_number)}: ${firstFailure.message}`}
                    />
                  ) : null}
                </Stack>
                <ImportBatchMetaField label={t("Updated Date")} value={formatDateTime(row.update_time || row.imported_at)} />
              </Stack>
            );
          }}
          rows={rows}
          stickyHeader
          toolbar={
            <ImportManagementTableToolbar
              dataView={importBatchesView}
              failedRowsInView={failedRowsInView}
              toolbarActions={toolbarActions}
              total={total}
            />
          }
        />
      }
    />
  );
}

export function ImportManagementSection({
  importBatchesQuery,
  importBatchesView,
  onStartImport,
}: ImportManagementSectionProps) {
  const { t } = useI18n();

  return (
    <ImportBatchWorkspaceTable
      chromeTestId="import-management-page-chrome"
      importBatchesQuery={importBatchesQuery}
      importBatchesView={importBatchesView}
      title={t("Import Management")}
      toolbarActions={
        onStartImport ? (
          <Button onClick={onStartImport} size="small" startIcon={<FileUploadRoundedIcon fontSize="small" />} variant="outlined">
            {t("Upload batch")}
          </Button>
        ) : null
      }
    />
  );
}
