import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { Alert, IconButton, Stack, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import {
  runInventoryInformationTemplateDownload,
  runInventoryInformationWorkbookUpload,
} from "@/features/inventory/controller/actions";
import { inboundApi } from "@/features/inbound/model/api";
import { inventoryApi } from "@/features/inventory/model/api";
import {
  buildInventoryInformationRows,
  compareInventoryInformationText,
  decodeInventoryInformationMultiValue,
  downloadInventoryInformationRowsCsv,
  matchesInventoryInformationQuery,
  sortInventoryInformationRowsByDirection,
} from "@/features/inventory/model/inventory-information";
import type { InventoryInformationRow, InventoryInformationSortKey } from "@/features/inventory/model/types";
import { outboundApi } from "@/features/outbound/model/api";
import { buildDistributionProductsPath, buildProductsPath } from "@/features/products/model/api";
import type { DistributionProductRecord, ProductRecord } from "@/features/products/model/types";
import { InventoryInformationImportDialog } from "@/features/inventory/view/InventoryInformationImportDialog";
import {
  InventoryInformationTable,
  type InventoryInformationFilterOption,
  type InventoryInformationFilters,
} from "@/features/inventory/view/InventoryInformationTable";
import { BulkActionBar } from "@/shared/components/bulk-action-bar";
import type { ResourceTableRowSelection } from "@/shared/components/resource-table";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import type {
  InventoryBalanceRecord,
  LocationRecord,
  PurchaseOrderRecord,
  PutawayTaskRecord,
  SalesOrderRecord,
} from "@/shared/types/domain";
import { parseApiError } from "@/shared/utils/parse-api-error";

const inventoryInformationPageSize = 10;

function buildStorageKey(companyOpenId: string | undefined, warehouseId: number | null) {
  if (!companyOpenId) {
    return null;
  }

  return `inventory-information.imports.${companyOpenId}.${warehouseId ?? "all"}`;
}

function parseStoredImportRows(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as InventoryInformationRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchesSelectedValue(selectedValues: Set<string>, value: string) {
  return selectedValues.size === 0 || selectedValues.has(value);
}

function matchesSelectedValues(selectedValues: Set<string>, values: string[]) {
  return selectedValues.size === 0 || values.some((value) => selectedValues.has(value));
}

function matchesInventoryCountRange(value: number, minimumText: string, maximumText: string) {
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);

  if (minimumText.trim() && Number.isFinite(minimum) && value < minimum) {
    return false;
  }

  if (maximumText.trim() && Number.isFinite(maximum) && value > maximum) {
    return false;
  }

  return true;
}

function buildStringOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function InventoryBalancesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translateText } = useI18n();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<InventoryInformationRow[]>([]);
  const [importErrorMessages, setImportErrorMessages] = useState<string[]>([]);
  const [importWarningMessages, setImportWarningMessages] = useState<string[]>([]);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [sorting, setSorting] = useState<{ key: InventoryInformationSortKey; direction: "asc" | "desc" }>({
    key: "merchantSku",
    direction: "asc",
  });
  const inventorySelection = useBulkSelection<string>();
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;

  const storageKey = buildStorageKey(company?.openid, activeWarehouseId);
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
    },
    pageSize: inventoryInformationPageSize,
  });

  const productsQuery = useResource<ProductRecord[]>(
    ["inventory", "information", "products", company?.id],
    buildProductsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const clientAccountsQuery = useResource<ClientAccountRecord[]>(
    ["inventory", "information", "client-accounts", company?.id],
    buildClientAccountsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "information", "balances", company?.id, activeWarehouseId ?? "all"],
    inventoryApi.balances,
    1,
    500,
    activeWarehouseId ? { warehouse: activeWarehouseId } : undefined,
  );

  const locationsQuery = useResource<PaginatedResponse<LocationRecord>>(
    ["inventory", "information", "locations", activeWarehouseId ?? "all"],
    "/api/locations/",
    {
      page_size: 500,
      warehouse: activeWarehouseId ?? undefined,
    },
  );

  const purchaseOrdersQuery = useResource<PaginatedResponse<PurchaseOrderRecord>>(
    ["inventory", "information", "purchase-orders", activeWarehouseId ?? "all"],
    inboundApi.purchaseOrders,
    {
      page_size: 500,
      warehouse: activeWarehouseId ?? undefined,
    },
    { enabled: Boolean(company?.id) },
  );

  const putawayTasksQuery = useResource<PaginatedResponse<PutawayTaskRecord>>(
    ["inventory", "information", "putaway-tasks", activeWarehouseId ?? "all"],
    inboundApi.putawayTasks,
    {
      page_size: 500,
      warehouse: activeWarehouseId ?? undefined,
    },
    { enabled: Boolean(company?.id) },
  );

  const salesOrdersQuery = useResource<PaginatedResponse<SalesOrderRecord>>(
    ["inventory", "information", "sales-orders", activeWarehouseId ?? "all"],
    outboundApi.salesOrders,
    {
      page_size: 500,
      warehouse: activeWarehouseId ?? undefined,
    },
    { enabled: Boolean(company?.id) },
  );

  const inventoryProductIds = useMemo(() => {
    const visibleSkus = new Set((balancesQuery.data?.results ?? []).map((balance) => balance.goods_code.trim().toUpperCase()));

    return (productsQuery.data ?? [])
      .filter((product) => visibleSkus.has(product.sku.trim().toUpperCase()))
      .map((product) => product.id);
  }, [balancesQuery.data?.results, productsQuery.data]);

  const distributionProductQueries = useQueries({
    queries: inventoryProductIds.map((productId) => ({
      queryKey: ["inventory", "information", "distribution-products", company?.id, productId],
      queryFn: () => apiGet<DistributionProductRecord[]>(buildDistributionProductsPath(company?.id ?? "0", productId)),
      enabled: Boolean(company?.id),
    })),
  });

  const distributionProducts = distributionProductQueries.flatMap((query) => query.data ?? []);
  const distributionProductsError = distributionProductQueries.find((query) => query.error)?.error;
  const isDistributionProductsLoading = distributionProductQueries.some((query) => query.isLoading);

  useEffect(() => {
    if (!storageKey) {
      setImportRows([]);
      return;
    }

    setImportRows(parseStoredImportRows(window.localStorage.getItem(storageKey)));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    if (importRows.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(importRows));
  }, [importRows, storageKey]);

  const allRows = useMemo(
    () =>
      buildInventoryInformationRows({
        balances: balancesQuery.data?.results ?? [],
        products: productsQuery.data ?? [],
        importedRows: importRows,
        clientAccounts: clientAccountsQuery.data ?? [],
        distributionProducts,
        purchaseOrders: purchaseOrdersQuery.data?.results ?? [],
        salesOrders: salesOrdersQuery.data?.results ?? [],
        putawayTasks: putawayTasksQuery.data?.results ?? [],
        locations: locationsQuery.data?.results ?? [],
        fallbackWarehouseName: activeWarehouse?.warehouse_name,
      }),
    [
      activeWarehouse?.warehouse_name,
      balancesQuery.data?.results,
      clientAccountsQuery.data,
      distributionProducts,
      importRows,
      locationsQuery.data?.results,
      productsQuery.data,
      purchaseOrdersQuery.data?.results,
      putawayTasksQuery.data?.results,
      salesOrdersQuery.data?.results,
    ],
  );

  const selectedWarehouseValues = useMemo(
    () => new Set(decodeInventoryInformationMultiValue(inventoryView.filters.warehouses)),
    [inventoryView.filters.warehouses],
  );
  const selectedTagValues = useMemo(
    () => new Set(decodeInventoryInformationMultiValue(inventoryView.filters.tags)),
    [inventoryView.filters.tags],
  );
  const selectedClientValues = useMemo(
    () => new Set(decodeInventoryInformationMultiValue(inventoryView.filters.clients)),
    [inventoryView.filters.clients],
  );
  const selectedSkuValues = useMemo(
    () => new Set(decodeInventoryInformationMultiValue(inventoryView.filters.merchantSkus)),
    [inventoryView.filters.merchantSkus],
  );

  const filteredRows = useMemo(
    () =>
      allRows.filter((row) => {
        if (!matchesInventoryInformationQuery(row, inventoryView.filters.query)) {
          return false;
        }
        if (!matchesSelectedValue(selectedWarehouseValues, row.warehouseName)) {
          return false;
        }
        if (!matchesSelectedValues(selectedTagValues, row.productTags)) {
          return false;
        }
        if (!matchesSelectedValue(selectedSkuValues, row.merchantSku)) {
          return false;
        }
        if (
          selectedClientValues.size > 0 &&
          !row.clients.some((client) => selectedClientValues.has(client.code))
        ) {
          return false;
        }
        if (
          !matchesInventoryCountRange(
            row.totalInventory,
            inventoryView.filters.inventoryCountMin,
            inventoryView.filters.inventoryCountMax,
          )
        ) {
          return false;
        }
        return true;
      }),
    [
      allRows,
      inventoryView.filters.inventoryCountMax,
      inventoryView.filters.inventoryCountMin,
      inventoryView.filters.query,
      selectedClientValues,
      selectedSkuValues,
      selectedTagValues,
      selectedWarehouseValues,
    ],
  );

  const sortedRows = useMemo(
    () => sortInventoryInformationRowsByDirection(filteredRows, sorting.key, sorting.direction),
    [filteredRows, sorting.direction, sorting.key],
  );

  const warehouseOptions = useMemo<InventoryInformationFilterOption[]>(
    () => buildStringOptions(Array.from(new Set(allRows.map((row) => row.warehouseName).filter(Boolean))).sort(compareInventoryInformationText)),
    [allRows],
  );

  const tagOptions = useMemo<InventoryInformationFilterOption[]>(
    () => buildStringOptions(Array.from(new Set(allRows.flatMap((row) => row.productTags))).sort(compareInventoryInformationText)),
    [allRows],
  );

  const clientOptions = useMemo<InventoryInformationFilterOption[]>(() => {
    const optionsByValue = new Map<string, InventoryInformationFilterOption>();

    allRows.forEach((row) => {
      row.clients.forEach((client) => {
        optionsByValue.set(client.code, { value: client.code, label: client.label });
      });
    });

    return Array.from(optionsByValue.values()).sort((left, right) => compareInventoryInformationText(left.label, right.label));
  }, [allRows]);

  const skuOptions = useMemo<InventoryInformationFilterOption[]>(
    () => buildStringOptions(Array.from(new Set(allRows.map((row) => row.merchantSku).filter(Boolean))).sort(compareInventoryInformationText)),
    [allRows],
  );

  useEffect(() => {
    inventorySelection.clearSelection();
  }, [inventorySelection.clearSelection, inventoryView.queryFilters]);

  const pagedRows = useMemo(() => {
    const startIndex = (inventoryView.page - 1) * inventoryView.pageSize;
    return sortedRows.slice(startIndex, startIndex + inventoryView.pageSize);
  }, [inventoryView.page, inventoryView.pageSize, sortedRows]);

  const selectedRows = useMemo(
    () => sortedRows.filter((row) => inventorySelection.selectedIds.includes(row.id)),
    [inventorySelection.selectedIds, sortedRows],
  );

  const inventoryRowSelection = useMemo<ResourceTableRowSelection<InventoryInformationRow>>(
    () => ({
      selectedRowIds: inventorySelection.selectedIds,
      onToggleAll: (rows) => inventorySelection.toggleMany(rows.map((row) => row.id)),
      onToggleRow: (row) => inventorySelection.toggleOne(row.id),
    }),
    [inventorySelection.selectedIds, inventorySelection.toggleMany, inventorySelection.toggleOne],
  );

  const exportRows = selectedRows.length > 0 ? selectedRows : sortedRows;
  const existingImportIdentityRows = useMemo(
    () => [
      ...importRows.map((row) => ({
        merchantSku: row.merchantSku,
        shelf: row.shelf,
        merchantCode: row.merchantCode,
        customerCode: row.customerCode,
      })),
      ...(balancesQuery.data?.results ?? []).map((balance) => ({
        merchantSku: balance.goods_code,
        shelf: balance.location_code,
        merchantCode: "",
        customerCode: "",
      })),
    ],
    [balancesQuery.data?.results, importRows],
  );
  const tableError =
    [
      productsQuery.error,
      clientAccountsQuery.error,
      balancesQuery.error,
      distributionProductsError,
      locationsQuery.error,
      purchaseOrdersQuery.error,
      putawayTasksQuery.error,
      salesOrdersQuery.error,
    ]
      .filter(Boolean)
      .map((error) => parseApiError(error))
      [0] ?? null;

  const isLoading =
    productsQuery.isLoading ||
    clientAccountsQuery.isLoading ||
    balancesQuery.isLoading ||
    isDistributionProductsLoading ||
    locationsQuery.isLoading ||
    purchaseOrdersQuery.isLoading ||
    putawayTasksQuery.isLoading ||
    salesOrdersQuery.isLoading;

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

  const handleExportRows = () => {
    downloadInventoryInformationRowsCsv(
      exportRows,
      selectedRows.length > 0 ? "inventory-information-selected" : "inventory-information-query",
    );
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
      const result = await runInventoryInformationWorkbookUpload(companyId, selectedImportFile, existingImportIdentityRows);

      if (result.errors.length > 0) {
        setImportErrorMessages(result.errors);
        setImportSuccessMessage(null);
        setImportWarningMessages([]);
        return;
      }

      setImportRows((currentRows) => [...result.importedRows, ...currentRows]);
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
                  disabled={exportRows.length === 0}
                  onClick={handleExportRows}
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
        clientOptions={clientOptions}
        dataView={inventoryView}
        error={tableError}
        isLoading={isLoading}
        rowSelection={inventoryRowSelection}
        rows={pagedRows}
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
          <BulkActionBar
            actions={[
              {
                key: "export-selected",
                label: "Export selected rows",
                onClick: handleExportRows,
                variant: "contained",
              },
            ]}
            helperText="Selection persists across pages within the current filtered result set."
            onClear={inventorySelection.clearSelection}
            selectedCount={selectedRows.length}
          />
        }
        skuOptions={skuOptions}
        tagOptions={tagOptions}
        total={sortedRows.length}
        warehouseOptions={warehouseOptions}
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
        onSubmit={() => void handleImportSubmit()}
        open={isImportDialogOpen}
        selectedFileName={selectedImportFile?.name ?? null}
      />
    </Stack>
  );
}
