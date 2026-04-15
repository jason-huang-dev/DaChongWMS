import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  buildInterwarehouseTransferBucketCounts,
  buildInterwarehouseTransferCsv,
  buildInterwarehouseTransferRows,
  createDefaultInterwarehouseTransferFilters,
  filterInterwarehouseTransferRows,
  formatTransferTypeLabel,
  interwarehouseTransferBucketItems,
  sortInterwarehouseTransferRows,
  type InterwarehouseTransferBucket,
  type InterwarehouseTransferFilters,
  type InterwarehouseTransferOrderRecord,
} from "@/features/inventory/model/interwarehouse-transfer";
import { mapCreateValuesToTransferOrderPayload } from "@/features/transfers/model/mappers";
import type { InventoryBalanceRecord, TransferOrderCreateValues } from "@/features/transfers/model/types";
import { apiGet, apiPost } from "@/lib/http";
import { useDataView } from "@/shared/hooks/use-data-view";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import type { PaginatedResponse } from "@/shared/types/api";
import type { LocationRecord } from "@/shared/types/domain";
import { downloadCsvFile } from "@/shared/utils/csv";
import { parseApiError } from "@/shared/utils/parse-api-error";

function buildOrganizationTransferOrdersPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/transfer-orders/`;
}

interface CreateTransferOrderMutationInput {
  balancesById: Map<number, InventoryBalanceRecord>;
  values: TransferOrderCreateValues;
}

export function useInventoryCrossWarehouseController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouseId, warehouses } = useTenantScope();
  const [activeBucket, setActiveBucket] = useState<InterwarehouseTransferBucket>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"createTime" | "stockOutTime" | "stockInTime" | "cancelTime">("createTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const dataView = useDataView<InterwarehouseTransferFilters>({
    viewKey: `inventory.cross-warehouse.transfer-orders.${company?.openid ?? "anonymous"}`,
    defaultFilters: createDefaultInterwarehouseTransferFilters(activeWarehouseId),
    pageSize: 50,
  });

  const transferOrdersQuery = useQuery({
    queryKey: ["inventory", "cross-warehouse", "transfer-orders", company?.id],
    queryFn: () =>
      apiGet<InterwarehouseTransferOrderRecord[]>(
        buildOrganizationTransferOrdersPath(company!.id),
      ),
    enabled: Boolean(company?.id),
  });

  const locationsQuery = useQuery({
    queryKey: ["inventory", "cross-warehouse", "locations", company?.id],
    queryFn: () =>
      apiGet<PaginatedResponse<LocationRecord>>("/api/locations/", {
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(company?.id),
  });

  const rows = useMemo(
    () =>
      buildInterwarehouseTransferRows(
        transferOrdersQuery.data ?? [],
        warehouses,
        locationsQuery.data?.results ?? [],
      ),
    [locationsQuery.data?.results, transferOrdersQuery.data, warehouses],
  );

  const filteredRows = useMemo(
    () => filterInterwarehouseTransferRows(rows, dataView.filters, activeBucket),
    [activeBucket, dataView.filters, rows],
  );

  const sortedRows = useMemo(
    () => sortInterwarehouseTransferRows(filteredRows, sortKey, sortDirection),
    [filteredRows, sortDirection, sortKey],
  );

  const pagedRows = useMemo(() => {
    const startIndex = (dataView.page - 1) * dataView.pageSize;
    return sortedRows.slice(startIndex, startIndex + dataView.pageSize);
  }, [dataView.page, dataView.pageSize, sortedRows]);

  const bucketCounts = useMemo(() => buildInterwarehouseTransferBucketCounts(rows), [rows]);

  const createTransferOrderMutation = useMutation({
    mutationFn: ({ balancesById, values }: CreateTransferOrderMutationInput) =>
      apiPost<InterwarehouseTransferOrderRecord>(
        buildOrganizationTransferOrdersPath(company!.id),
        mapCreateValuesToTransferOrderPayload(values, balancesById),
      ),
    onSuccess: async (transferOrder) => {
      setCreateErrorMessage(null);
      setCreateSuccessMessage(`Transfer order ${transferOrder.transfer_number} created.`);
      setIsCreateDialogOpen(false);
      await invalidateQueryGroups(queryClient, [
        ["inventory"],
        ["transfers"],
        ["dashboard"],
      ]);
    },
    onError: (error) => {
      setCreateSuccessMessage(null);
      setCreateErrorMessage(parseApiError(error));
    },
  });

  const hasActiveFilters = dataView.activeFilterCount > 0 || activeBucket !== "all";
  const filterOptions = {
    transferTypes: [
      { label: "Transfer Type", value: "" },
      { label: formatTransferTypeLabel("CROSS_WAREHOUSE"), value: "CROSS_WAREHOUSE" },
      { label: formatTransferTypeLabel("INTERNAL_RELOCATION"), value: "INTERNAL_RELOCATION" },
      { label: formatTransferTypeLabel("MIXED"), value: "MIXED" },
    ],
  } as const;

  return {
    activeBucket,
    bucketItems: interwarehouseTransferBucketItems.map((item) => ({
      ...item,
      count: bucketCounts[item.value],
    })),
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    dataView,
    filterOptions,
    hasActiveFilters,
    isCreateDialogOpen,
    locationsQuery,
    openCreateDialog: () => setIsCreateDialogOpen(true),
    closeCreateDialog: () => setIsCreateDialogOpen(false),
    pagination: {
      page: dataView.page,
      pageSize: dataView.pageSize,
      total: sortedRows.length,
      onPageChange: dataView.setPage,
    },
    columnVisibilityStorageKey: `inventory.cross-warehouse.transfer-orders.columns.${company?.openid ?? "anonymous"}`,
    queryError:
      transferOrdersQuery.error || locationsQuery.error
        ? parseApiError(transferOrdersQuery.error ?? locationsQuery.error)
        : null,
    refetch: async () => {
      await Promise.all([transferOrdersQuery.refetch(), locationsQuery.refetch()]);
    },
    resetFilters: () => {
      dataView.resetFilters();
      setActiveBucket("all");
    },
    rows: pagedRows,
    setActiveBucket,
    setSort: (nextSortKey: "createTime" | "stockOutTime" | "stockInTime" | "cancelTime") => {
      if (sortKey === nextSortKey) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(nextSortKey);
      setSortDirection("desc");
    },
    sorting: {
      direction: sortDirection,
      sortKey,
    },
    transferOrdersQuery,
    warehouses,
    exportVisibleRows: () =>
      downloadCsvFile(
        buildInterwarehouseTransferCsv(sortedRows),
        `interwarehouse-transfer-${new Date().toISOString().slice(0, 10)}.csv`,
      ),
  };
}
