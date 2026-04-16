import type { DataViewFilters } from "@/shared/hooks/use-data-view";

export type StockInListSearchField = "po_number" | "customer" | "supplier" | "reference_code";
export type StockInListDateField = "create_time" | "expected_arrival_date";
export type StockInListStatusTabValue = "all" | "active" | "completed" | "cancelled";

export interface StockInListFilters extends DataViewFilters {
  po_number__icontains: string;
  status: string;
  status__in: string;
  searchField: StockInListSearchField | "";
  searchValue: string;
  dateField: StockInListDateField | "";
  dateFrom: string;
  dateTo: string;
}

interface StockInListStatusTabConfig {
  status: string;
  status__in: string;
  value: StockInListStatusTabValue;
}

export const defaultStockInListSearchField: StockInListSearchField = "po_number";
export const defaultStockInListDateField: StockInListDateField = "create_time";

export const stockInListStatusTabConfigs: readonly StockInListStatusTabConfig[] = [
  { value: "all", status: "", status__in: "" },
  { value: "active", status: "", status__in: "OPEN,PARTIAL" },
  { value: "completed", status: "CLOSED", status__in: "" },
  { value: "cancelled", status: "CANCELLED", status__in: "" },
] as const;

function normalizeFilterValue(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizePurchaseOrderStatus(value?: string | null) {
  const normalizedValue = normalizeFilterValue(value).toUpperCase();
  if (normalizedValue === "RECEIVED") {
    return "CLOSED";
  }
  return normalizedValue;
}

function normalizeStatusSet(value?: string | null) {
  return normalizeFilterValue(value)
    .split(",")
    .map((item) => normalizePurchaseOrderStatus(item))
    .filter(Boolean)
    .sort()
    .join(",");
}

export function resolveStockInListSearchField(filters: Pick<StockInListFilters, "searchField">) {
  return filters.searchField || defaultStockInListSearchField;
}

export function resolveStockInListDateField(filters: Pick<StockInListFilters, "dateField">) {
  return filters.dateField || defaultStockInListDateField;
}

export function resolveStockInListSearchValue(filters: Pick<StockInListFilters, "po_number__icontains" | "searchValue">) {
  return normalizeFilterValue(filters.searchValue) || normalizeFilterValue(filters.po_number__icontains);
}

export function resolveStockInListStatusTab(filters: Pick<StockInListFilters, "status" | "status__in">): StockInListStatusTabValue {
  const normalizedStatus = normalizePurchaseOrderStatus(filters.status);
  const normalizedStatusSet = normalizeStatusSet(filters.status__in);

  if (normalizedStatus === "CLOSED") {
    return "completed";
  }
  if (normalizedStatus === "CANCELLED") {
    return "cancelled";
  }
  if (normalizedStatus === "OPEN" || normalizedStatus === "PARTIAL" || normalizedStatusSet === "OPEN,PARTIAL") {
    return "active";
  }

  return "all";
}

export function buildStockInListTabFilters(value: StockInListStatusTabValue) {
  const config = stockInListStatusTabConfigs.find((item) => item.value === value) ?? stockInListStatusTabConfigs[0];

  return {
    status: config.status,
    status__in: config.status__in,
  };
}

export function countStockInListActiveFilters(filters: StockInListFilters) {
  let count = 0;

  if (normalizeFilterValue(filters.status) || normalizeFilterValue(filters.status__in)) {
    count += 1;
  }
  if (resolveStockInListSearchValue(filters)) {
    count += 1;
  }
  if (normalizeFilterValue(filters.dateFrom) || normalizeFilterValue(filters.dateTo)) {
    count += 1;
  }

  return count;
}

export function buildStockInListQueryFilters(filters: StockInListFilters) {
  const queryFilters: Record<string, string> = {};
  const normalizedStatus = normalizePurchaseOrderStatus(filters.status);
  const normalizedStatusSet = normalizeStatusSet(filters.status__in);
  const resolvedSearchValue = resolveStockInListSearchValue(filters);
  const normalizedDateFrom = normalizeFilterValue(filters.dateFrom);
  const normalizedDateTo = normalizeFilterValue(filters.dateTo);

  if (normalizedStatus) {
    queryFilters.status = normalizedStatus;
  }
  if (normalizedStatusSet) {
    queryFilters.status__in = normalizedStatusSet;
  }
  if (resolvedSearchValue) {
    queryFilters.search_field = resolveStockInListSearchField(filters);
    queryFilters.search_value = resolvedSearchValue;
  } else if (normalizeFilterValue(filters.po_number__icontains)) {
    queryFilters.po_number__icontains = normalizeFilterValue(filters.po_number__icontains);
  }
  if (normalizedDateFrom || normalizedDateTo) {
    queryFilters.date_field = resolveStockInListDateField(filters);
    if (normalizedDateFrom) {
      queryFilters.date_from = normalizedDateFrom;
    }
    if (normalizedDateTo) {
      queryFilters.date_to = normalizedDateTo;
    }
  }

  return queryFilters;
}
