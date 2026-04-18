import type { SalesOrderRecord } from "@/features/outbound/model/types";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import { downloadCsvFile, escapeCsvValue } from "@/shared/utils/csv";

export type StockOutStatusBucket =
  | "all"
  | "get-tracking-no"
  | "to-move"
  | "in-process"
  | "to-ship"
  | "shipped"
  | "abnormal-package"
  | "order-interception";

export type StockOutSearchField =
  | "orderNumber"
  | "trackingNumber"
  | "waybillNumber"
  | "referenceCode"
  | "customerName"
  | "query";

export type StockOutDateField = "requestedShipDate" | "orderTime" | "createTime";
export type StockOutMatchMode = "contains" | "exact";

export interface StockOutListFilters extends DataViewFilters {
  customerAccountId: string;
  dateField: StockOutDateField;
  dateFrom: string;
  dateTo: string;
  exceptionState: string;
  fulfillmentStage: string;
  logisticsProvider: string;
  matchMode: StockOutMatchMode;
  orderType: string;
  packageCountMax: string;
  packageCountMin: string;
  packageType: string;
  searchField: StockOutSearchField;
  searchText: string;
  shippingMethod: string;
  status: string;
  statusBucket: StockOutStatusBucket;
  statusIn: string;
  waybillPrinted: string;
}

export interface StockOutStatusBucketDefinition {
  label: string;
  value: StockOutStatusBucket;
}

const stockOutStatusBucketQueryMap: Record<StockOutStatusBucket, Record<string, string>> = {
  all: {},
  "get-tracking-no": { fulfillment_stage: "GET_TRACKING_NO" },
  "to-move": { fulfillment_stage: "TO_MOVE" },
  "in-process": { fulfillment_stage: "IN_PROCESS" },
  "to-ship": { fulfillment_stage: "TO_SHIP" },
  shipped: { status: "SHIPPED" },
  "abnormal-package": { exception_state: "ABNORMAL_PACKAGE" },
  "order-interception": { exception_state: "ORDER_INTERCEPTION" },
};

export const stockOutStatusBuckets: StockOutStatusBucketDefinition[] = [
  { label: "All packages", value: "all" },
  { label: "Get tracking no", value: "get-tracking-no" },
  { label: "To move", value: "to-move" },
  { label: "In process orders", value: "in-process" },
  { label: "To ship", value: "to-ship" },
  { label: "Shipped", value: "shipped" },
  { label: "Abnormal package", value: "abnormal-package" },
  { label: "Order interception", value: "order-interception" },
] as const;

export const stockOutOrderTypeOptions = [
  { label: "Standard", value: "STANDARD" },
  { label: "B2B", value: "B2B" },
  { label: "Dropshipping", value: "DROPSHIP" },
] as const;

export const stockOutStatusOptions = [
  { label: "Open", value: "OPEN" },
  { label: "Allocated", value: "ALLOCATED" },
  { label: "Picking", value: "PICKING" },
  { label: "Picked", value: "PICKED" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

export const stockOutFulfillmentStageOptions = [
  { label: "Get tracking no", value: "GET_TRACKING_NO" },
  { label: "To move", value: "TO_MOVE" },
  { label: "In process", value: "IN_PROCESS" },
  { label: "To ship", value: "TO_SHIP" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

export const stockOutExceptionOptions = [
  { label: "Normal", value: "NORMAL" },
  { label: "Abnormal package", value: "ABNORMAL_PACKAGE" },
  { label: "Order interception", value: "ORDER_INTERCEPTION" },
] as const;

export const stockOutWaybillPrintedOptions = [
  { label: "Printed", value: "true" },
  { label: "Not printed", value: "false" },
] as const;

export const stockOutSearchFieldOptions = [
  { label: "Order number", value: "orderNumber" },
  { label: "Tracking number", value: "trackingNumber" },
  { label: "Waybill number", value: "waybillNumber" },
  { label: "Reference code", value: "referenceCode" },
  { label: "Client", value: "customerName" },
  { label: "Search all", value: "query" },
] as const;

export const stockOutMatchModeOptions = [
  { label: "Contains", value: "contains" },
  { label: "Exact", value: "exact" },
] as const;

export const stockOutDateFieldOptions = [
  { label: "Requested ship date", value: "requestedShipDate" },
  { label: "Order time", value: "orderTime" },
  { label: "Create time", value: "createTime" },
] as const;

export const defaultStockOutListFilters: StockOutListFilters = {
  customerAccountId: "",
  dateField: "requestedShipDate",
  dateFrom: "",
  dateTo: "",
  exceptionState: "",
  fulfillmentStage: "",
  logisticsProvider: "",
  matchMode: "contains",
  orderType: "",
  packageCountMax: "",
  packageCountMin: "",
  packageType: "",
  searchField: "orderNumber",
  searchText: "",
  shippingMethod: "",
  status: "",
  statusBucket: "all",
  statusIn: "",
  waybillPrinted: "",
};

function getSearchParamValue(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  return value?.trim() ?? "";
}

function inferSearchFieldFromParams(searchParams: URLSearchParams): StockOutSearchField {
  if (getSearchParamValue(searchParams, "trackingNumber")) {
    return "trackingNumber";
  }
  if (getSearchParamValue(searchParams, "waybillNumber")) {
    return "waybillNumber";
  }
  if (getSearchParamValue(searchParams, "referenceCode")) {
    return "referenceCode";
  }
  if (getSearchParamValue(searchParams, "customerName")) {
    return "customerName";
  }
  return "orderNumber";
}

function inferSearchTextFromParams(searchParams: URLSearchParams) {
  return (
    getSearchParamValue(searchParams, "salesOrderNumber")
    || getSearchParamValue(searchParams, "trackingNumber")
    || getSearchParamValue(searchParams, "waybillNumber")
    || getSearchParamValue(searchParams, "referenceCode")
    || getSearchParamValue(searchParams, "customerName")
  );
}

export function inferStockOutStatusBucket(filters: Pick<
  StockOutListFilters,
  "exceptionState" | "fulfillmentStage" | "status"
>) {
  if (filters.exceptionState === "ABNORMAL_PACKAGE") {
    return "abnormal-package";
  }
  if (filters.exceptionState === "ORDER_INTERCEPTION") {
    return "order-interception";
  }
  if (filters.fulfillmentStage === "GET_TRACKING_NO") {
    return "get-tracking-no";
  }
  if (filters.fulfillmentStage === "TO_MOVE") {
    return "to-move";
  }
  if (filters.fulfillmentStage === "IN_PROCESS") {
    return "in-process";
  }
  if (filters.fulfillmentStage === "TO_SHIP") {
    return "to-ship";
  }
  if (filters.status === "SHIPPED" || filters.fulfillmentStage === "SHIPPED") {
    return "shipped";
  }

  return "all";
}

export function buildInitialStockOutListFilters(searchParams: URLSearchParams): StockOutListFilters {
  const nextFilters: StockOutListFilters = {
    ...defaultStockOutListFilters,
    dateField: (getSearchParamValue(searchParams, "dateField") as StockOutDateField) || defaultStockOutListFilters.dateField,
    dateFrom: getSearchParamValue(searchParams, "dateFrom") || getSearchParamValue(searchParams, "shipFrom"),
    dateTo: getSearchParamValue(searchParams, "dateTo") || getSearchParamValue(searchParams, "shipTo"),
    exceptionState: getSearchParamValue(searchParams, "salesOrderException"),
    fulfillmentStage: getSearchParamValue(searchParams, "salesOrderStage"),
    matchMode: (getSearchParamValue(searchParams, "matchMode") as StockOutMatchMode) || defaultStockOutListFilters.matchMode,
    orderType: getSearchParamValue(searchParams, "orderType"),
    searchField: inferSearchFieldFromParams(searchParams),
    searchText: inferSearchTextFromParams(searchParams),
    status: getSearchParamValue(searchParams, "salesOrderStatus"),
    statusIn: getSearchParamValue(searchParams, "salesOrderStatuses"),
    waybillPrinted: getSearchParamValue(searchParams, "waybillPrinted"),
  };

  nextFilters.statusBucket = inferStockOutStatusBucket(nextFilters);
  return nextFilters;
}

export function buildStockOutBucketQuery(statusBucket: StockOutStatusBucket) {
  return stockOutStatusBucketQueryMap[statusBucket];
}

export function buildStockOutListQuery(filters: StockOutListFilters) {
  const query: Record<string, string> = {
    ...buildStockOutBucketQuery(filters.statusBucket),
  };

  if (filters.customerAccountId) {
    query.customer = filters.customerAccountId;
  }
  if (filters.orderType) {
    query.order_type = filters.orderType;
  }
  if (filters.packageType.trim()) {
    query.package_type = filters.packageType.trim();
  }
  if (filters.logisticsProvider.trim()) {
    query.logistics_provider__icontains = filters.logisticsProvider.trim();
  }
  if (filters.shippingMethod.trim()) {
    query.shipping_method__icontains = filters.shippingMethod.trim();
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.statusIn) {
    query.status__in = filters.statusIn;
  }
  if (filters.fulfillmentStage) {
    query.fulfillment_stage = filters.fulfillmentStage;
  }
  if (filters.exceptionState) {
    query.exception_state = filters.exceptionState;
  }
  if (filters.waybillPrinted) {
    query.waybill_printed = filters.waybillPrinted;
  }
  if (filters.packageCountMin.trim()) {
    query.package_count__gte = filters.packageCountMin.trim();
  }
  if (filters.packageCountMax.trim()) {
    query.package_count__lte = filters.packageCountMax.trim();
  }
  if (filters.dateFrom) {
    if (filters.dateField === "orderTime") {
      query.order_time__gte = filters.dateFrom;
    } else if (filters.dateField === "createTime") {
      query.create_time__gte = filters.dateFrom;
    } else {
      query.requested_ship_date__gte = filters.dateFrom;
    }
  }
  if (filters.dateTo) {
    if (filters.dateField === "orderTime") {
      query.order_time__lte = filters.dateTo;
    } else if (filters.dateField === "createTime") {
      query.create_time__lte = filters.dateTo;
    } else {
      query.requested_ship_date__lte = filters.dateTo;
    }
  }

  const searchText = filters.searchText.trim();
  if (!searchText) {
    return query;
  }

  if (filters.searchField === "query") {
    query.query = searchText;
    return query;
  }

  const isExactMatch = filters.matchMode === "exact";

  switch (filters.searchField) {
    case "trackingNumber":
      query[isExactMatch ? "tracking_number" : "tracking_number__icontains"] = searchText;
      break;
    case "waybillNumber":
      query[isExactMatch ? "waybill_number" : "waybill_number__icontains"] = searchText;
      break;
    case "referenceCode":
      query[isExactMatch ? "reference_code" : "reference_code__icontains"] = searchText;
      break;
    case "customerName":
      query[isExactMatch ? "customer_name" : "customer_name__icontains"] = searchText;
      break;
    case "orderNumber":
    default:
      query[isExactMatch ? "order_number" : "order_number__icontains"] = searchText;
      break;
  }

  return query;
}

export function buildStockOutRowsCsvContent(rows: SalesOrderRecord[]) {
  const header = [
    "Order Number",
    "Client",
    "Order Type",
    "Package Type",
    "Package Count",
    "Status",
    "Fulfillment Stage",
    "Exception State",
    "Waybill Printed",
    "Waybill Number",
    "Tracking Number",
    "Logistics Provider",
    "Shipping Method",
    "Requested Ship Date",
    "Order Time",
    "Create Time",
  ];

  const lines = rows.map((row) =>
    [
      row.order_number,
      row.customer_name,
      row.order_type,
      row.package_type,
      row.package_count,
      row.status,
      row.fulfillment_stage,
      row.exception_state,
      row.waybill_printed ? "Yes" : "No",
      row.waybill_number,
      row.tracking_number,
      row.logistics_provider,
      row.shipping_method,
      row.requested_ship_date,
      row.order_time,
      row.create_time,
    ]
      .map((value) => escapeCsvValue(value))
      .join(","),
  );

  return [header.map((value) => escapeCsvValue(value)).join(","), ...lines].join("\n");
}

export function downloadStockOutRowsCsv(rows: SalesOrderRecord[], filenamePrefix: string) {
  downloadCsvFile(buildStockOutRowsCsvContent(rows), `${filenamePrefix}.csv`);
}
