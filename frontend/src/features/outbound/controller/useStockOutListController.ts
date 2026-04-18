import { useCallback, useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSearchParams } from "react-router-dom";

import { useTenantScope } from "@/app/scope-context";
import { outboundApi, updateSalesOrder } from "@/features/outbound/model/api";
import {
  buildInitialStockOutListFilters,
  buildStockOutListQuery,
  defaultStockOutListFilters,
  downloadStockOutRowsCsv,
  stockOutStatusBuckets,
  type StockOutListFilters,
  type StockOutStatusBucket,
} from "@/features/outbound/model/stock-out-list";
import type { SalesOrderRecord } from "@/features/outbound/model/types";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useSalesOrderReferenceOptions } from "@/shared/hooks/use-reference-options";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";
import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

type StockOutSortKey = "createTime" | "expiresAt" | "orderTime" | "requestedShipDate" | "status";

const exportPageSize = 200;

async function fetchAllStockOutRows(query: Record<string, string>) {
  let page = 1;
  const rows: SalesOrderRecord[] = [];

  while (true) {
    const response = await apiGet<PaginatedResponse<SalesOrderRecord>>(outboundApi.salesOrders, {
      ...query,
      page,
      page_size: exportPageSize,
    });

    rows.push(...response.results);

    if (!response.next || rows.length >= response.count) {
      return rows;
    }

    page += 1;
  }
}

function buildCountScopedFilters(filters: StockOutListFilters): StockOutListFilters {
  return {
    ...filters,
    exceptionState: "",
    fulfillmentStage: "",
    status: "",
    statusBucket: "all",
    statusIn: "",
  };
}

function buildSortQuery(sortKey: StockOutSortKey, direction: "asc" | "desc") {
  return {
    sortDirection: direction,
    sortKey,
  };
}

function useStockOutBucketCountQuery(
  bucket: StockOutStatusBucket,
  activeWarehouseId: number | null,
  filters: StockOutListFilters,
  enabled: boolean,
) {
  return usePaginatedResource<SalesOrderRecord>(
    ["outbound", "stock-out", "bucket-count", bucket],
    outboundApi.salesOrders,
    1,
    1,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...buildStockOutListQuery({
        ...filters,
        statusBucket: bucket,
      }),
    },
    { enabled },
  );
}

export function useStockOutListController() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { activeWarehouse, activeWarehouseId, company } = useTenantScope();
  const [sorting, setSorting] = useState<{ direction: "asc" | "desc"; key: StockOutSortKey }>({
    direction: "desc",
    key: "createTime",
  });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const initialFilters = useMemo(() => buildInitialStockOutListFilters(searchParams), [searchParams]);
  const salesOrdersView = useDataView<StockOutListFilters>({
    defaultFilters: initialFilters,
    pageSize: 25,
    viewKey: `outbound.stock-out.${company?.openid ?? "anonymous"}`,
  });
  const selection = useBulkSelection<number>();
  const filterSignature = JSON.stringify(salesOrdersView.queryFilters);
  const countScopedFilters = useMemo(() => buildCountScopedFilters(salesOrdersView.filters), [salesOrdersView.filters]);
  const referenceSalesOrders = useSalesOrderReferenceOptions(activeWarehouseId, salesOrdersView.filters.orderType || null);
  const activeFilterCount = useMemo(
    () =>
      [
        salesOrdersView.filters.customerAccountId !== defaultStockOutListFilters.customerAccountId,
        salesOrdersView.filters.dateFrom !== defaultStockOutListFilters.dateFrom
          || salesOrdersView.filters.dateTo !== defaultStockOutListFilters.dateTo,
        salesOrdersView.filters.exceptionState !== defaultStockOutListFilters.exceptionState,
        salesOrdersView.filters.fulfillmentStage !== defaultStockOutListFilters.fulfillmentStage,
        salesOrdersView.filters.logisticsProvider !== defaultStockOutListFilters.logisticsProvider,
        salesOrdersView.filters.orderType !== defaultStockOutListFilters.orderType,
        salesOrdersView.filters.packageCountMax !== defaultStockOutListFilters.packageCountMax
          || salesOrdersView.filters.packageCountMin !== defaultStockOutListFilters.packageCountMin,
        salesOrdersView.filters.packageType !== defaultStockOutListFilters.packageType,
        salesOrdersView.filters.searchText !== defaultStockOutListFilters.searchText,
        salesOrdersView.filters.shippingMethod !== defaultStockOutListFilters.shippingMethod,
        salesOrdersView.filters.status !== defaultStockOutListFilters.status,
        salesOrdersView.filters.statusBucket !== defaultStockOutListFilters.statusBucket,
        salesOrdersView.filters.statusIn !== defaultStockOutListFilters.statusIn,
        salesOrdersView.filters.waybillPrinted !== defaultStockOutListFilters.waybillPrinted,
      ].filter(Boolean).length,
    [salesOrdersView.filters],
  );

  const customerOptions = useMemo(() => {
    const seenCustomerIds = new Set<number>();

    return referenceSalesOrders.options
      .flatMap((option) => {
        const record = option.record;
        if (seenCustomerIds.has(record.customer)) {
          return [];
        }
        seenCustomerIds.add(record.customer);
        return [{ label: record.customer_name, value: String(record.customer) }];
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [referenceSalesOrders.options]);

  const salesOrdersQuery = usePaginatedResource<SalesOrderRecord>(
    ["outbound", "stock-out", "sales-orders"],
    outboundApi.salesOrders,
    salesOrdersView.page,
    salesOrdersView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...buildStockOutListQuery(salesOrdersView.filters),
      ...buildSortQuery(sorting.key, sorting.direction),
    },
    { enabled: Boolean(company?.id) },
  );
  const allBucketCountQuery = useStockOutBucketCountQuery("all", activeWarehouseId, countScopedFilters, Boolean(company?.id));
  const getTrackingNoBucketCountQuery = useStockOutBucketCountQuery(
    "get-tracking-no",
    activeWarehouseId,
    countScopedFilters,
    Boolean(company?.id),
  );
  const toMoveBucketCountQuery = useStockOutBucketCountQuery("to-move", activeWarehouseId, countScopedFilters, Boolean(company?.id));
  const inProcessBucketCountQuery = useStockOutBucketCountQuery(
    "in-process",
    activeWarehouseId,
    countScopedFilters,
    Boolean(company?.id),
  );
  const toShipBucketCountQuery = useStockOutBucketCountQuery("to-ship", activeWarehouseId, countScopedFilters, Boolean(company?.id));
  const shippedBucketCountQuery = useStockOutBucketCountQuery("shipped", activeWarehouseId, countScopedFilters, Boolean(company?.id));
  const abnormalBucketCountQuery = useStockOutBucketCountQuery(
    "abnormal-package",
    activeWarehouseId,
    countScopedFilters,
    Boolean(company?.id),
  );
  const interceptionBucketCountQuery = useStockOutBucketCountQuery(
    "order-interception",
    activeWarehouseId,
    countScopedFilters,
    Boolean(company?.id),
  );
  const bucketCountQueries = {
    all: allBucketCountQuery,
    "abnormal-package": abnormalBucketCountQuery,
    "get-tracking-no": getTrackingNoBucketCountQuery,
    "in-process": inProcessBucketCountQuery,
    "order-interception": interceptionBucketCountQuery,
    shipped: shippedBucketCountQuery,
    "to-move": toMoveBucketCountQuery,
    "to-ship": toShipBucketCountQuery,
  } satisfies Record<StockOutStatusBucket, { data?: { count: number } }>;

  useEffect(() => {
    selection.clearSelection();
  }, [filterSignature, salesOrdersView.page, selection.clearSelection]);

  const selectedRows = useMemo(
    () => (salesOrdersQuery.data?.results ?? []).filter((row) => selection.selectedIds.includes(row.id)),
    [salesOrdersQuery.data?.results, selection.selectedIds],
  );

  const markAbnormalMutation = useMutation({
    mutationFn: async (salesOrderIds: number[]) =>
      Promise.all(
        salesOrderIds.map((salesOrderId) =>
          updateSalesOrder(String(salesOrderId), { exception_state: "ABNORMAL_PACKAGE" }),
        ),
      ),
    onSuccess: async (_response, salesOrderIds) => {
      setFeedbackError(null);
      setFeedbackMessage(
        salesOrderIds.length === 1
          ? "Marked 1 order as abnormal."
          : `Marked ${salesOrderIds.length} orders as abnormal.`,
      );
      selection.clearSelection();
      await invalidateQueryGroups(queryClient, [["outbound"], ["dashboard"]]);
    },
    onError: (error) => {
      setFeedbackMessage(null);
      setFeedbackError(parseApiError(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (selectedRows.length > 0) {
        return selectedRows;
      }

      return fetchAllStockOutRows({
        warehouse: String(activeWarehouseId ?? ""),
        ...buildStockOutListQuery(salesOrdersView.filters),
        ...buildSortQuery(sorting.key, sorting.direction),
      });
    },
    onSuccess: (rows) => {
      setFeedbackError(null);
      setFeedbackMessage(
        rows.length === 0
          ? "No stock-out rows matched the current filters."
          : `Exported ${rows.length} stock-out rows.`,
      );
      if (rows.length > 0) {
        downloadStockOutRowsCsv(rows, `stock-out-${new Date().toISOString().slice(0, 10)}`);
      }
    },
    onError: (error) => {
      setFeedbackMessage(null);
      setFeedbackError(parseApiError(error));
    },
  });

  const setStatusBucket = useCallback(
    (value: StockOutStatusBucket) => {
      salesOrdersView.updateFilter("status", "");
      salesOrdersView.updateFilter("statusIn", "");
      salesOrdersView.updateFilter("fulfillmentStage", "");
      salesOrdersView.updateFilter("exceptionState", "");
      salesOrdersView.updateFilter("statusBucket", value);
    },
    [salesOrdersView],
  );

  const updateFilter = useCallback(
    (key: keyof StockOutListFilters & string, value: string) => {
      if (key === "status" || key === "statusIn" || key === "fulfillmentStage" || key === "exceptionState") {
        salesOrdersView.updateFilter("statusBucket", "all");
      }

      salesOrdersView.updateFilter(key, value);
    },
    [salesOrdersView],
  );

  const handleSortChange = useCallback((nextSortKey: string) => {
    setSorting((currentSorting) => ({
      direction: currentSorting.key === nextSortKey && currentSorting.direction === "asc" ? "desc" : "asc",
      key: nextSortKey as StockOutSortKey,
    }));
  }, []);

  return {
    activeWarehouse,
    activeFilterCount,
    bucketItems: stockOutStatusBuckets.map((bucket) => ({
      count: bucketCountQueries[bucket.value].data?.count ?? 0,
      label: bucket.label,
      value: bucket.value,
    })),
    customerOptions,
    errorMessage: feedbackError,
    exportRows: () => exportMutation.mutateAsync(),
    feedbackMessage,
    isExporting: exportMutation.isPending,
    isMarkingAbnormal: markAbnormalMutation.isPending,
    markSelectedAsAbnormal: () => markAbnormalMutation.mutateAsync(selection.selectedIds),
    pagination: {
      onPageChange: salesOrdersView.setPage,
      page: salesOrdersView.page,
      pageSize: salesOrdersView.pageSize,
      total: salesOrdersQuery.data?.count ?? 0,
    },
    refetchSalesOrders: () => salesOrdersQuery.refetch(),
    rowSelection: {
      onToggleAll: (rows: SalesOrderRecord[]) => selection.toggleMany(rows.map((row) => row.id)),
      onToggleRow: (row: SalesOrderRecord) => selection.toggleOne(row.id),
      selectedRowIds: selection.selectedIds,
    },
    rows: salesOrdersQuery.data?.results ?? [],
    salesOrdersQuery,
    salesOrdersView,
    selectedCount: selection.selectedCount,
    selectedRows,
    setStatusBucket,
    sorting: {
      direction: sorting.direction,
      onSortChange: handleSortChange,
      sortKey: sorting.key,
    },
    updateFilter,
  };
}
