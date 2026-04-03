import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Alert, Button, IconButton, Stack, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import {
  runInventoryInformationTemplateDownload,
  runInventoryInformationWorkbookUpload,
} from "@/features/inventory/controller/actions";
import { inventoryApi } from "@/features/inventory/model/api";
import { downloadInventoryInformationRowsCsv } from "@/features/inventory/model/inventory-information";
import type {
  InventoryInformationListResponse,
  InventoryInformationRow,
  InventoryInformationSortKey,
} from "@/features/inventory/model/types";
import { InventoryInformationImportDialog } from "@/features/inventory/view/InventoryInformationImportDialog";
import { InventoryLabelPrintDialog } from "@/features/inventory/view/InventoryLabelPrintDialog";
import {
  InventoryInformationTable,
  type InventoryInformationFilterOption,
  type InventoryInformationFilters,
} from "@/features/inventory/view/InventoryInformationTable";
import type { ResourceTableRowSelection } from "@/shared/components/resource-table";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { apiGet } from "@/lib/http";
import { parseApiError } from "@/shared/utils/parse-api-error";

const inventoryInformationPageSize = 10;
const exportBatchSize = 500;

function buildInventoryInformationQueryParams({
  page,
  pageSize,
  warehouseId,
  filters,
  sorting,
}: {
  page: number;
  pageSize: number;
  warehouseId: number | null;
  filters: Record<string, string>;
  sorting: { key: InventoryInformationSortKey; direction: "asc" | "desc" };
}) {
  return {
    page,
    page_size: pageSize,
    warehouse_id: warehouseId ?? undefined,
    sortKey: sorting.key,
    sortDirection: sorting.direction,
    ...filters,
  };
}

async function fetchAllInventoryInformationRows({
  organizationId,
  warehouseId,
  filters,
  sorting,
}: {
  organizationId: number;
  warehouseId: number | null;
  filters: Record<string, string>;
  sorting: { key: InventoryInformationSortKey; direction: "asc" | "desc" };
}) {
  let page = 1;
  const rows: InventoryInformationRow[] = [];

  while (true) {
    const response = await apiGet<InventoryInformationListResponse>(
      inventoryApi.information(organizationId),
      buildInventoryInformationQueryParams({
        page,
        pageSize: exportBatchSize,
        warehouseId,
        filters,
        sorting,
      }),
    );

    rows.push(...response.results);
    if (!response.next || rows.length >= response.count) {
      break;
    }
    page += 1;
  }

  return rows;
}

export function InventoryBalancesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const queryClient = useQueryClient();
  const { t, translateText } = useI18n();
  const { company, activeWarehouseId } = useTenantScope();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importErrorMessages, setImportErrorMessages] = useState<string[]>([]);
  const [importWarningMessages, setImportWarningMessages] = useState<string[]>([]);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sorting, setSorting] = useState<{ key: InventoryInformationSortKey; direction: "asc" | "desc" }>({
    key: "merchantSku",
    direction: "asc",
  });
  const [selectedRowLookup, setSelectedRowLookup] = useState<Record<string, InventoryInformationRow>>({});
  const inventorySelection = useBulkSelection<string>();
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;

  const inventoryView = useDataView<InventoryInformationFilters>({
    viewKey: `inventory-information.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      query: "",
      warehouses: "",
      tags: "",
      clients: "",
      merchantSkus: "",
      inventoryCountMin: "",
      inventoryCountMax: "",
      hideZeroStock: "",
    },
    pageSize: inventoryInformationPageSize,
  });

  const inventoryInformationQuery = useQuery({
    queryKey: [
      "inventory",
      "information",
      companyId,
      activeWarehouseId ?? "all",
      inventoryView.page,
      inventoryView.pageSize,
      inventoryView.queryFilters,
      sorting,
    ],
    queryFn: () =>
      apiGet<InventoryInformationListResponse>(
        inventoryApi.information(companyId ?? "0"),
        buildInventoryInformationQueryParams({
          page: inventoryView.page,
          pageSize: inventoryView.pageSize,
          warehouseId: activeWarehouseId,
          filters: inventoryView.queryFilters,
          sorting,
        }),
      ),
    enabled: Boolean(companyId),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    inventorySelection.clearSelection();
    setSelectedRowLookup({});
  }, [activeWarehouseId, companyId, inventorySelection.clearSelection, inventoryView.queryFilters]);

  useEffect(() => {
    const rows = inventoryInformationQuery.data?.results ?? [];
    if (rows.length === 0) {
      return;
    }

    setSelectedRowLookup((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.id, row])),
    }));
  }, [inventoryInformationQuery.data?.results]);

  useEffect(() => {
    if (inventorySelection.selectedIds.length > 0) {
      return;
    }

    setSelectedRowLookup({});
  }, [inventorySelection.selectedIds.length]);

  const rows = inventoryInformationQuery.data?.results ?? [];
  const filterOptions = inventoryInformationQuery.data?.filterOptions;
  const currentPageRowLookup = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row])),
    [rows],
  );
  const selectedRows = useMemo(
    () =>
      inventorySelection.selectedIds
        .map((id) => selectedRowLookup[id] ?? currentPageRowLookup[id])
        .filter((row): row is InventoryInformationRow => Boolean(row)),
    [currentPageRowLookup, inventorySelection.selectedIds, selectedRowLookup],
  );

  const inventoryRowSelection = useMemo<ResourceTableRowSelection<InventoryInformationRow>>(
    () => ({
      selectedRowIds: inventorySelection.selectedIds,
      onToggleAll: (tableRows) => inventorySelection.toggleMany(tableRows.map((row) => row.id)),
      onToggleRow: (row) => inventorySelection.toggleOne(row.id),
    }),
    [inventorySelection.selectedIds, inventorySelection.toggleMany, inventorySelection.toggleOne],
  );

  const handleOpenImportDialog = () => {
    setImportErrorMessages([]);
    setSelectedImportFile(null);
    setIsImportDialogOpen(true);
  };

  const handleCloseImportDialog = () => {
    setImportErrorMessages([]);
    setSelectedImportFile(null);
    setIsImportDialogOpen(false);
  };

  const handleExportRows = async () => {
    if (!companyId) {
      return;
    }

    setIsExporting(true);
    try {
      const exportRows =
        selectedRows.length > 0
          ? selectedRows
          : await fetchAllInventoryInformationRows({
              organizationId: companyId,
              warehouseId: activeWarehouseId,
              filters: inventoryView.queryFilters,
              sorting,
            });

      downloadInventoryInformationRowsCsv(
        exportRows,
        selectedRows.length > 0 ? "inventory-information-selected" : "inventory-information-query",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!selectedImportFile) {
      setImportErrorMessages([translateText("Select an .xlsx file before importing.")]);
      return;
    }
    if (!companyId) {
      setImportErrorMessages([translateText("Select an active workspace membership before importing inventory information.")]);
      return;
    }

    setIsImporting(true);
    try {
      const result = await runInventoryInformationWorkbookUpload(companyId, selectedImportFile, activeWarehouseId);

      if (result.errors.length > 0) {
        setImportErrorMessages(result.errors);
        setImportSuccessMessage(null);
        setImportWarningMessages([]);
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ["inventory", "information", companyId, activeWarehouseId ?? "all"],
      });
      setImportSuccessMessage(t("inventory.importRowsSuccess", { count: result.importedRows.length }));
      setImportWarningMessages(result.warnings);
      setImportErrorMessages([]);
      setSelectedImportFile(null);
      setIsImportDialogOpen(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Stack spacing={3}>
      {!company ? (
        <Alert severity="info">{translateText("Select an active workspace membership before managing inventory information.")}</Alert>
      ) : null}
      {importSuccessMessage ? <Alert severity="success">{importSuccessMessage}</Alert> : null}
      {importWarningMessages.length > 0 ? (
        <Alert severity="warning">
          <Stack spacing={0.5}>
            {importWarningMessages.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </Stack>
        </Alert>
      ) : null}
      <InventoryInformationTable
        actions={
          <Stack direction="row" spacing={0.75}>
            <Tooltip
              enterDelay={200}
              title={translateText(selectedRows.length > 0 ? "Export selected rows" : "Export queried rows")}
            >
              <span>
                <IconButton
                  aria-label={translateText(selectedRows.length > 0 ? "Export selected rows" : "Export queried rows")}
                  disabled={!companyId || isExporting || (selectedRows.length === 0 && !inventoryInformationQuery.data?.count)}
                  onClick={() => {
                    void handleExportRows();
                  }}
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
                    border: `1px solid ${alpha(theme.palette.success.main, isDark ? 0.34 : 0.22)}`,
                    borderRadius: 2,
                    color: theme.palette.success.main,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.success.main, isDark ? 0.26 : 0.18),
                    },
                  }}
                >
                  <FileDownloadOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip enterDelay={200} title={translateText("Print selected labels")}>
              <span>
                <IconButton
                  aria-label={translateText("Print selected labels")}
                  disabled={selectedRows.length === 0}
                  onClick={() => setIsPrintDialogOpen(true)}
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.22 : 0.14),
                    border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.36 : 0.22)}`,
                    borderRadius: 2,
                    color: theme.palette.warning.main,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.28 : 0.18),
                    },
                  }}
                >
                  <LocalPrintshopOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip enterDelay={200} title={translateText("Download template")}>
              <span>
                <IconButton
                  aria-label={translateText("Download template")}
                  disabled={!companyId}
                  onClick={() => {
                    if (companyId) {
                      void runInventoryInformationTemplateDownload(companyId);
                    }
                  }}
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.88),
                    border: `1px solid ${alpha(theme.palette.divider, 0.86)}`,
                    borderRadius: 2,
                    color: theme.palette.text.primary,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.58 : 0.98),
                    },
                  }}
                >
                  <DownloadOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip enterDelay={200} title={translateText("Import XLSX")}>
              <IconButton
                aria-label={translateText("Import XLSX")}
                onClick={handleOpenImportDialog}
                size="small"
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
                  border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.4 : 0.26)}`,
                  borderRadius: 2,
                  color: theme.palette.primary.main,
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18),
                  },
                }}
              >
                <UploadFileOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
        clientOptions={filterOptions?.clients ?? ([] as InventoryInformationFilterOption[])}
        dataView={inventoryView}
        error={inventoryInformationQuery.error ? parseApiError(inventoryInformationQuery.error) : null}
        isLoading={inventoryInformationQuery.isLoading}
        hideZeroStock={inventoryView.filters.hideZeroStock === "true"}
        onHideZeroStockChange={(checked) => inventoryView.updateFilter("hideZeroStock", checked ? "true" : "")}
        rowSelection={inventoryRowSelection}
        rows={rows}
        selectedCount={inventorySelection.selectedIds.length}
        sortDirection={sorting.direction}
        sortKey={sorting.key}
        onSortChange={(nextSortKey) => {
          setSorting((currentSorting) =>
            currentSorting.key === nextSortKey
              ? {
                  direction: currentSorting.direction === "asc" ? "desc" : "asc",
                  key: nextSortKey,
                }
              : {
                  direction: "asc",
                  key: nextSortKey,
                },
          );
          inventoryView.setPage(1);
        }}
        selectionBar={
          inventorySelection.selectedIds.length > 0 ? (
            <Stack alignItems="center" direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Button color="inherit" onClick={inventorySelection.clearSelection} size="small">
                {translateText("Clear selection")}
              </Button>
            </Stack>
          ) : null
        }
        skuOptions={filterOptions?.skus ?? ([] as InventoryInformationFilterOption[])}
        tagOptions={filterOptions?.tags ?? ([] as InventoryInformationFilterOption[])}
        total={inventoryInformationQuery.data?.count ?? 0}
        warehouseOptions={filterOptions?.warehouses ?? ([] as InventoryInformationFilterOption[])}
      />
      <InventoryInformationImportDialog
        errorMessages={importErrorMessages}
        isSubmitting={isImporting}
        onClose={handleCloseImportDialog}
        onDownloadTemplate={() => {
          if (companyId) {
            void runInventoryInformationTemplateDownload(companyId);
          }
        }}
        onFileChange={(file) => {
          setSelectedImportFile(file);
          setImportErrorMessages([]);
        }}
        onSubmit={() => {
          void handleImportSubmit();
        }}
        open={isImportDialogOpen}
        selectedFileName={selectedImportFile?.name ?? null}
      />
      <InventoryLabelPrintDialog onClose={() => setIsPrintDialogOpen(false)} open={isPrintDialogOpen} rows={selectedRows} />
    </Stack>
  );
}
