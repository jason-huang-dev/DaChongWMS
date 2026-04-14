import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LocalPrintshopOutlinedIcon from "@mui/icons-material/LocalPrintshopOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Alert, Box, Button, Stack } from "@mui/material";

import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import {
  compareInventoryInformationText,
  decodeInventoryInformationMultiValue,
  downloadInventoryInformationRowsCsv,
  sortInventoryInformationRowsByDirection,
} from "@/features/inventory/model/inventory-information";
import {
  runInventoryInformationTemplateDownload,
  runInventoryInformationWorkbookUpload,
} from "@/features/inventory/controller/actions";
import { inventoryApi } from "@/features/inventory/model/api";
import type {
  InventoryInformationListResponse,
  InventoryInformationRow,
  InventoryInformationSortKey,
} from "@/features/inventory/model/types";
import { InventoryInformationImportDialog } from "@/features/inventory/view/InventoryInformationImportDialog";
import { InventoryLabelPrintDialog } from "@/features/inventory/view/InventoryLabelPrintDialog";
import {
  InventoryInformationTable,
  type InventoryInformationAreaFilter,
  type InventoryInformationAreaTabItem,
  type InventoryInformationFilterOption,
  type InventoryInformationFilters,
  type InventoryInformationMetricField,
  type InventoryInformationProductSearchField,
} from "@/features/inventory/view/InventoryInformationTable";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import type { DataTableRowSelection } from "@/shared/components/data-table";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { apiGet } from "@/lib/http";
import { parseApiError } from "@/shared/utils/parse-api-error";

const inventoryInformationPageSize = 10;
const exportBatchSize = 500;

function normalizeFilterText(value: string) {
  return value.trim().toLowerCase();
}

function buildWarehouseOptions(rows: InventoryInformationRow[]): InventoryInformationFilterOption[] {
  return Array.from(
    new Set(rows.map((row) => row.warehouseName).filter(Boolean)),
  )
    .sort(compareInventoryInformationText)
    .map((warehouseName) => ({ label: warehouseName, value: warehouseName }));
}

function buildClientOptions(rows: InventoryInformationRow[]): InventoryInformationFilterOption[] {
  const clientMap = new Map<string, string>();

  rows.forEach((row) => {
    if (row.customerCode && !clientMap.has(row.customerCode)) {
      clientMap.set(row.customerCode, row.clients[0]?.label || row.customerCode);
    }
    row.clients.forEach((client) => {
      if (client.code && !clientMap.has(client.code)) {
        clientMap.set(client.code, client.label || client.code);
      }
    });
  });

  return Array.from(clientMap.entries())
    .sort((left, right) => compareInventoryInformationText(left[1], right[1]))
    .map(([value, label]) => ({ label, value }));
}

function readProductSearchValue(row: InventoryInformationRow, field: InventoryInformationProductSearchField) {
  switch (field) {
    case "merchantCode":
      return row.merchantCode;
    case "productBarcode":
      return row.productBarcode;
    case "productName":
      return row.productName || row.merchantSku;
    case "merchantSku":
    default:
      return row.merchantSku;
  }
}

function readMetricValue(row: InventoryInformationRow, field: InventoryInformationMetricField) {
  switch (field) {
    case "inTransit":
      return row.inTransit;
    case "pendingReceival":
      return row.pendingReceival;
    case "toList":
      return row.toList;
    case "orderAllocated":
      return row.orderAllocated;
    case "availableStock":
      return row.availableStock;
    case "defectiveProducts":
      return row.defectiveProducts;
    case "totalInventory":
    default:
      return row.totalInventory;
  }
}

function matchesTextSearch(value: string, query: string) {
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) {
    return true;
  }

  return value.toLowerCase().includes(normalizedQuery);
}

function matchesAreaFilter(row: InventoryInformationRow, area: InventoryInformationAreaFilter) {
  if (area === "all") {
    return true;
  }

  return row.areaKey === area;
}

function filterInventoryInformationRows(
  rows: InventoryInformationRow[],
  filters: InventoryInformationFilters,
  options?: { includeArea?: boolean },
) {
  const includeArea = options?.includeArea ?? true;
  const selectedWarehouses = decodeInventoryInformationMultiValue(filters.warehouses);
  const selectedClients = decodeInventoryInformationMultiValue(filters.clients);
  const normalizedShelfQuery = normalizeFilterText(filters.shelfQuery);
  const normalizedProductSearch = normalizeFilterText(filters.productSearchValue);
  const metricMin = filters.metricMin.trim() ? Number(filters.metricMin) : null;
  const metricMax = filters.metricMax.trim() ? Number(filters.metricMax) : null;

  return rows.filter((row) => {
    if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(row.warehouseName)) {
      return false;
    }

    if (selectedClients.length > 0) {
      const rowClientCodes = [row.customerCode, ...row.clients.map((client) => client.code)].filter(Boolean);
      if (!rowClientCodes.some((clientCode) => selectedClients.includes(clientCode))) {
        return false;
      }
    }

    if (normalizedProductSearch) {
      const productFieldValue = readProductSearchValue(row, filters.productSearchField);
      if (!matchesTextSearch(productFieldValue, normalizedProductSearch)) {
        return false;
      }
    }

    if (normalizedShelfQuery) {
      const shelves = [row.shelf, ...row.shelves].filter(Boolean);
      if (!shelves.some((shelf) => shelf.toLowerCase().includes(normalizedShelfQuery))) {
        return false;
      }
    }

    const metricValue = readMetricValue(row, filters.metricField);
    if (metricMin !== null && Number.isFinite(metricMin) && metricValue < metricMin) {
      return false;
    }
    if (metricMax !== null && Number.isFinite(metricMax) && metricValue > metricMax) {
      return false;
    }

    if (filters.hideZeroStock === "true" && row.totalInventory <= 0) {
      return false;
    }

    if (includeArea && !matchesAreaFilter(row, filters.area)) {
      return false;
    }

    return true;
  });
}

function buildAreaTabs(
  rows: InventoryInformationRow[],
  translateLabel: (key: string) => string,
): InventoryInformationAreaTabItem[] {
  return [
    { count: rows.length, label: translateLabel("All areas"), value: "all" },
    { count: rows.filter((row) => row.areaKey === "storage").length, label: translateLabel("Storage area"), value: "storage" },
    { count: rows.filter((row) => row.areaKey === "picking").length, label: translateLabel("Picking area"), value: "picking" },
    { count: rows.filter((row) => row.areaKey === "defect").length, label: translateLabel("Defective area"), value: "defect" },
  ];
}

function paginateRows(rows: InventoryInformationRow[], page: number, pageSize: number) {
  const start = Math.max(page - 1, 0) * pageSize;
  return rows.slice(start, start + pageSize);
}

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
  const queryClient = useQueryClient();
  const { t, translate, msg } = useI18n();
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
  const inventorySelection = useBulkSelection<string>();
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;

  const inventoryView = useDataView<InventoryInformationFilters>({
    viewKey: `inventory-information.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      area: "all",
      warehouses: "",
      clients: "",
      productSearchField: "merchantSku",
      productSearchValue: "",
      shelfQuery: "",
      metricField: "totalInventory",
      metricMin: "",
      metricMax: "",
      hideZeroStock: "",
    },
    pageSize: inventoryInformationPageSize,
  });

  const inventoryInformationQuery = useQuery({
    queryKey: [
      "inventory",
      "information",
      "all",
      companyId,
    ],
    queryFn: () =>
      fetchAllInventoryInformationRows({
        organizationId: companyId ?? 0,
        warehouseId: null,
        filters: {},
        sorting: {
          key: "merchantSku",
          direction: "asc",
        },
      }),
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    inventorySelection.clearSelection();
  }, [activeWarehouseId, companyId, inventorySelection.clearSelection, inventoryView.queryFilters]);

  const allRows = inventoryInformationQuery.data ?? [];
  const warehouseOptions = useMemo(() => buildWarehouseOptions(allRows), [allRows]);
  const clientOptions = useMemo(() => buildClientOptions(allRows), [allRows]);
  const filteredRowsWithoutArea = useMemo(
    () => filterInventoryInformationRows(allRows, inventoryView.filters, { includeArea: false }),
    [allRows, inventoryView.filters],
  );
  const areaTabs = useMemo(() => buildAreaTabs(filteredRowsWithoutArea, t), [filteredRowsWithoutArea, t]);
  const filteredRows = useMemo(
    () => filterInventoryInformationRows(filteredRowsWithoutArea, inventoryView.filters),
    [filteredRowsWithoutArea, inventoryView.filters],
  );
  const activeFilterCount = useMemo(
    () =>
      [
        inventoryView.filters.area !== "all",
        Boolean(inventoryView.filters.warehouses),
        Boolean(inventoryView.filters.clients),
        Boolean(inventoryView.filters.productSearchValue.trim()),
        Boolean(inventoryView.filters.shelfQuery.trim()),
        Boolean(inventoryView.filters.metricMin.trim()),
        Boolean(inventoryView.filters.metricMax.trim()),
        inventoryView.filters.hideZeroStock === "true",
      ].filter(Boolean).length,
    [inventoryView.filters],
  );
  const sortedRows = useMemo(
    () => sortInventoryInformationRowsByDirection(filteredRows, sorting.key, sorting.direction),
    [filteredRows, sorting.direction, sorting.key],
  );
  const rows = useMemo(
    () => paginateRows(sortedRows, inventoryView.page, inventoryView.pageSize),
    [inventoryView.page, inventoryView.pageSize, sortedRows],
  );
  const allRowsById = useMemo(
    () => Object.fromEntries(allRows.map((row) => [row.id, row])),
    [allRows],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedRows.length / inventoryView.pageSize));
    if (inventoryView.page > maxPage) {
      inventoryView.setPage(maxPage);
    }
  }, [inventoryView.page, inventoryView.pageSize, inventoryView.setPage, sortedRows.length]);

  const selectedRows = useMemo(
    () =>
      inventorySelection.selectedIds
        .map((id) => allRowsById[id])
        .filter((row): row is InventoryInformationRow => Boolean(row)),
    [allRowsById, inventorySelection.selectedIds],
  );

  const inventoryRowSelection = useMemo<DataTableRowSelection<InventoryInformationRow>>(
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
      const exportRows = selectedRows.length > 0 ? selectedRows : sortedRows;

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
      setImportErrorMessages([t("Select an .xlsx file before importing.")]);
      return;
    }
    if (!companyId) {
      setImportErrorMessages([t("Select an active workspace membership before importing inventory information.")]);
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
        queryKey: ["inventory", "information", "all", companyId],
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
    <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
      {!company ? (
        <Alert severity="info">{t("Select an active workspace membership before managing inventory information.")}</Alert>
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
      <Box sx={{ flex: "1 1 auto", minHeight: 0 }}>
        <InventoryInformationTable
          activeFilterCount={activeFilterCount}
          actions={
            <Stack direction="row" spacing={0.75}>
              <ActionIconButton
                aria-label={selectedRows.length > 0 ? t("Export selected rows") : t("Export queried rows")}
                disabled={!companyId || isExporting || (selectedRows.length === 0 && sortedRows.length === 0)}
                onClick={() => {
                  void handleExportRows();
                }}
                title={selectedRows.length > 0 ? t("Export selected rows") : t("Export queried rows")}
                tone="success"
              >
                <FileDownloadOutlinedIcon fontSize="small" />
              </ActionIconButton>
              <ActionIconButton
                aria-label={t("Print selected labels")}
                disabled={selectedRows.length === 0}
                onClick={() => setIsPrintDialogOpen(true)}
                title={t("Print selected labels")}
                tone="warning"
              >
                <LocalPrintshopOutlinedIcon fontSize="small" />
              </ActionIconButton>
              <ActionIconButton
                aria-label={t("Download template")}
                disabled={!companyId}
                onClick={() => {
                  if (companyId) {
                    void runInventoryInformationTemplateDownload(companyId);
                  }
                }}
                title={t("Download template")}
              >
                <DownloadOutlinedIcon fontSize="small" />
              </ActionIconButton>
              <ActionIconButton
                aria-label={t("Import XLSX")}
                onClick={handleOpenImportDialog}
                title={t("Import XLSX")}
                tone="primary"
              >
                <UploadFileOutlinedIcon fontSize="small" />
              </ActionIconButton>
            </Stack>
          }
          areaFilter={inventoryView.filters.area}
          areaTabs={areaTabs}
          clientOptions={clientOptions}
          dataView={inventoryView}
          error={inventoryInformationQuery.error ? parseApiError(inventoryInformationQuery.error) : null}
          isLoading={inventoryInformationQuery.isLoading}
          hideZeroStock={inventoryView.filters.hideZeroStock === "true"}
          onAreaFilterChange={(value) => inventoryView.updateFilter("area", value)}
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
                  {t("Clear selection")}
                </Button>
              </Stack>
            ) : null
          }
          total={sortedRows.length}
          warehouseOptions={warehouseOptions}
        />
      </Box>
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
