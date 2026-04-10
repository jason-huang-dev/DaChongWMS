import { useEffect, useMemo, useState } from "react";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Alert, Box, Stack } from "@mui/material";

import { useTenantScope } from "@/app/scope-context";
import { runInventoryAdjustmentListCreate } from "@/features/inventory/controller/actions";
import { inventoryApi } from "@/features/inventory/model/api";
import {
  buildInventoryAdjustmentGroups,
  downloadInventoryAdjustmentGroupsCsv,
} from "@/features/inventory/model/mappers";
import type {
  InventoryAdjustmentListValues,
  InventoryMovementHistoryListResponse,
  InventoryMovementHistoryRow,
} from "@/features/inventory/model/types";
import {
  InventoryAdjustmentCreateDialog,
} from "@/features/inventory/view/components/InventoryAdjustmentCreateDialog";
import {
  InventoryAdjustmentFilters,
  type InventoryAdjustmentViewFilters,
} from "@/features/inventory/view/components/InventoryAdjustmentFilters";
import { InventoryAdjustmentsTable } from "@/features/inventory/view/components/InventoryAdjustmentsTable";
import { encodeInventoryInformationMultiValue } from "@/features/inventory/model/inventory-information";
import { AppToast } from "@/shared/components/app-toast";
import { FilterCard } from "@/shared/components/filter-card";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import { useDataView } from "@/shared/hooks/use-data-view";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";
import { apiGet } from "@/lib/http";

const inventoryAdjustmentFetchPageSize = 200;
const inventoryAdjustmentTablePageSize = 50;

function buildInventoryAdjustmentHistoryQueryParams({
  page,
  pageSize,
  warehouseId,
  filters,
}: {
  page: number;
  pageSize: number;
  warehouseId: number | null;
  filters: InventoryAdjustmentViewFilters;
}) {
  const searchText = filters.searchText.trim();
  const searchField = filters.searchField || "merchantSku";
  const searchParams =
    searchText.length > 0
      ? searchField === "referenceCode"
        ? { referenceCode: searchText }
        : searchField === "locationCode"
          ? { locationCode: searchText }
          : searchField === "performedBy"
            ? { performedBy: searchText }
            : searchField === "query"
              ? { query: searchText }
              : { merchantSku: searchText }
      : {};

  return {
    page,
    page_size: pageSize,
    warehouse_id: warehouseId ?? undefined,
    sortDirection: "desc",
    sortKey: "occurredAt",
    movementTypes: encodeInventoryInformationMultiValue(
      filters.adjustmentType ? [filters.adjustmentType] : ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"],
    ),
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    matchMode: filters.matchMode || undefined,
    ...searchParams,
  };
}

async function fetchAllInventoryAdjustmentHistoryRows({
  organizationId,
  warehouseId,
  filters,
}: {
  organizationId: number;
  warehouseId: number | null;
  filters: InventoryAdjustmentViewFilters;
}) {
  let page = 1;
  const rows: InventoryMovementHistoryRow[] = [];

  while (true) {
    const response = await apiGet<InventoryMovementHistoryListResponse>(
      inventoryApi.movementHistory(organizationId),
      buildInventoryAdjustmentHistoryQueryParams({
        page,
        pageSize: inventoryAdjustmentFetchPageSize,
        warehouseId,
        filters,
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

function paginateInventoryAdjustmentGroups<TItem>(rows: TItem[], page: number, pageSize: number) {
  const start = Math.max(page - 1, 0) * pageSize;
  return rows.slice(start, start + pageSize);
}

function countActiveInventoryAdjustmentFilters(filters: InventoryAdjustmentViewFilters) {
  return [
    Boolean(filters.adjustmentType),
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
    Boolean(filters.searchText.trim()),
    Boolean(filters.matchMode),
  ].filter(Boolean).length;
}

export function InventoryAdjustmentsPage() {
  const {
    company,
    activeWarehouseId,
    setActiveWarehouseId,
    warehouses,
  } = useTenantScope();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [adjustmentErrorMessage, setAdjustmentErrorMessage] = useState<string | null>(null);
  const [adjustmentSuccessMessage, setAdjustmentSuccessMessage] = useState<string | null>(null);
  const adjustmentView = useDataView<InventoryAdjustmentViewFilters>({
    viewKey: `inventory-adjustments.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      adjustmentType: "",
      dateFrom: "",
      dateTo: "",
      matchMode: "",
      searchField: "merchantSku",
      searchText: "",
    },
    pageSize: inventoryAdjustmentTablePageSize,
  });
  const pageChrome = useCollapsibleTablePageChrome();
  const companyId = company?.id !== undefined && company?.id !== null ? Number(company.id) : null;
  const activeFilterCount = countActiveInventoryAdjustmentFilters(adjustmentView.filters);

  const adjustmentHistoryQuery = useQuery({
    queryKey: [
      "inventory",
      "adjustments",
      companyId,
      activeWarehouseId ?? "none",
      adjustmentView.filters,
    ],
    queryFn: () =>
      fetchAllInventoryAdjustmentHistoryRows({
        organizationId: companyId ?? 0,
        warehouseId: activeWarehouseId,
        filters: adjustmentView.filters,
      }),
    enabled: Boolean(companyId && activeWarehouseId),
    placeholderData: keepPreviousData,
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: (values: InventoryAdjustmentListValues) =>
      runInventoryAdjustmentListCreate(companyId ?? 0, values),
    onSuccess: async (result, values) => {
      setAdjustmentErrorMessage(null);
      setAdjustmentSuccessMessage(
        `Created adjustment list ${result.reference_code} with ${result.count} items.`,
      );
      setActiveWarehouseId(values.warehouseId);
      setIsCreateDialogOpen(false);
      await invalidateQueryGroups(queryClient, [
        ["dashboard"],
        ["inventory"],
      ]);
    },
    onError: (error: unknown) => {
      setAdjustmentSuccessMessage(null);
      setAdjustmentErrorMessage(parseApiError(error));
    },
  });

  const groupedAdjustments = useMemo(
    () => buildInventoryAdjustmentGroups(adjustmentHistoryQuery.data ?? []),
    [adjustmentHistoryQuery.data],
  );
  const pagedAdjustments = useMemo(
    () =>
      paginateInventoryAdjustmentGroups(
        groupedAdjustments,
        adjustmentView.page,
        adjustmentView.pageSize,
      ),
    [adjustmentView.page, adjustmentView.pageSize, groupedAdjustments],
  );
  const selectedAdjustments = useMemo(
    () => groupedAdjustments.filter((group) => selectedGroupIds.includes(group.id)),
    [groupedAdjustments, selectedGroupIds],
  );

  useEffect(() => {
    const currentGroupIds = new Set(groupedAdjustments.map((group) => group.id));
    setSelectedGroupIds((currentSelectedGroupIds) => {
      const nextSelectedGroupIds = currentSelectedGroupIds.filter((groupId) => currentGroupIds.has(groupId));
      return nextSelectedGroupIds.length === currentSelectedGroupIds.length
        ? currentSelectedGroupIds
        : nextSelectedGroupIds;
    });
  }, [groupedAdjustments]);

  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
      {!company ? (
        <Alert severity="info">
          Select an active workspace membership before reviewing inventory adjustments.
        </Alert>
      ) : null}
      {!activeWarehouseId ? (
        <Alert severity="info">
          Select an active warehouse before creating or reviewing adjustment lists.
        </Alert>
      ) : null}
      <StickyTableLayout
        spacing={2}
        sx={{ flex: "1 1 auto", minHeight: 0 }}
        filters={
          <Box
            aria-hidden={pageChrome.isCollapsed}
            data-collapse-progress="0.00"
            data-testid="inventory-adjustments-page-chrome"
            ref={pageChrome.wrapperRef}
            sx={pageChrome.wrapperSx}
          >
            <Box ref={pageChrome.contentRef}>
              <FilterCard
                contentSx={{
                  pb: "14px !important",
                  pt: 1.25,
                }}
              >
                <InventoryAdjustmentFilters
                  filters={adjustmentView.filters}
                  onChange={adjustmentView.updateFilter}
                  onWarehouseChange={(warehouseId) => setActiveWarehouseId(warehouseId)}
                  warehouseId={activeWarehouseId}
                  warehouses={warehouses}
                />
              </FilterCard>
            </Box>
          </Box>
        }
        table={
          <InventoryAdjustmentsTable
            activeFilterCount={activeFilterCount}
            error={adjustmentHistoryQuery.error ? parseApiError(adjustmentHistoryQuery.error) : null}
            groups={pagedAdjustments}
            isLoading={adjustmentHistoryQuery.isLoading}
            onClearSelection={() => setSelectedGroupIds([])}
            onExport={() =>
              downloadInventoryAdjustmentGroupsCsv(
                selectedAdjustments.length > 0 ? selectedAdjustments : groupedAdjustments,
                selectedAdjustments.length > 0 ? "inventory-adjustments-selected" : "inventory-adjustments",
              )
            }
            onOpenCreate={() => {
              setAdjustmentErrorMessage(null);
              setIsCreateDialogOpen(true);
            }}
            onPageChange={adjustmentView.setPage}
            onRefresh={() => {
              void adjustmentHistoryQuery.refetch();
            }}
            onResetFilters={adjustmentView.resetFilters}
            onScrollStateChange={pageChrome.handleTableScrollStateChange}
            page={adjustmentView.page}
            pageSize={adjustmentView.pageSize}
            rowSelection={{
              onToggleAll: (rows) =>
                setSelectedGroupIds((currentSelectedGroupIds) => {
                  const rowIds = rows.map((row) => row.id);
                  const allRowsSelected =
                    rowIds.length > 0 && rowIds.every((rowId) => currentSelectedGroupIds.includes(rowId));
                  return allRowsSelected ? [] : rowIds;
                }),
              onToggleRow: (row) =>
                setSelectedGroupIds((currentSelectedGroupIds) =>
                  currentSelectedGroupIds.includes(row.id)
                    ? currentSelectedGroupIds.filter((rowId) => rowId !== row.id)
                    : [...currentSelectedGroupIds, row.id],
                ),
              selectedRowIds: selectedGroupIds,
            }}
            selectedCount={selectedAdjustments.length}
            total={groupedAdjustments.length}
          />
        }
      />
      <InventoryAdjustmentCreateDialog
        errorMessage={adjustmentErrorMessage}
        initialWarehouseId={activeWarehouseId}
        isSubmitting={createAdjustmentMutation.isPending}
        onClose={() => {
          setAdjustmentErrorMessage(null);
          setIsCreateDialogOpen(false);
        }}
        onSubmit={(values) => createAdjustmentMutation.mutateAsync(values)}
        open={isCreateDialogOpen}
        warehouses={warehouses}
      />
      <AppToast
        message={adjustmentSuccessMessage}
        onClose={() => setAdjustmentSuccessMessage(null)}
        open={Boolean(adjustmentSuccessMessage)}
        severity="success"
      />
    </Stack>
  );
}
