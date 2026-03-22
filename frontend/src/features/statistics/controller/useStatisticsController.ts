import { useMemo, useState } from "react";

import { useTenantScope } from "@/app/scope-context";
import { inboundApi } from "@/features/inbound/model/api";
import type {
  AdvanceShipmentNoticeRecord,
  InboundSigningRecord,
  PurchaseOrderRecord,
  PutawayTaskRecord,
  ReceiptRecord,
} from "@/features/inbound/model/types";
import { inventoryApi } from "@/features/inventory/model/api";
import type { InventoryBalanceRecord } from "@/features/inventory/model/types";
import { outboundApi } from "@/features/outbound/model/api";
import type {
  PackageExecutionRecord,
  PickTaskRecord,
  SalesOrderRecord,
  ShipmentRecord,
} from "@/features/outbound/model/types";
import { returnsApi } from "@/features/returns/model/api";
import type {
  ReturnDispositionRecord,
  ReturnOrderRecord,
  ReturnReceiptRecord,
} from "@/features/returns/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import type { WarehouseRecord } from "@/shared/types/domain";

import type {
  ActivityPerformanceRow,
  StaffPerformanceRow,
  StatisticsFlowRow,
  StatisticsTimeWindow,
  WarehouseAnalysisRow,
} from "../model/types";

const queryPageSize = 200;

type QuantityValue = string | number | null | undefined;

function parseQuantity(value: QuantityValue): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumQuantities(values: QuantityValue[]): number {
  return values.reduce<number>((total, value) => total + parseQuantity(value), 0);
}

function sumPurchaseOrderUnits(records: PurchaseOrderRecord[]) {
  return records.reduce(
    (total, record) => total + sumQuantities(record.lines.map((line) => line.ordered_qty)),
    0,
  );
}

function sumReceiptUnits(records: ReceiptRecord[]) {
  return records.reduce(
    (total, record) => total + sumQuantities(record.lines.map((line) => line.received_qty)),
    0,
  );
}

function sumSalesOrderUnits(records: SalesOrderRecord[]) {
  return records.reduce(
    (total, record) => total + sumQuantities(record.lines.map((line) => line.ordered_qty)),
    0,
  );
}

function sumShipmentUnits(records: ShipmentRecord[]) {
  return records.reduce(
    (total, record) => total + sumQuantities(record.lines.map((line) => line.shipped_qty)),
    0,
  );
}

function sumReturnOrderUnits(records: ReturnOrderRecord[]) {
  return records.reduce(
    (total, record) => total + sumQuantities(record.lines.map((line) => line.expected_qty)),
    0,
  );
}

function buildWindowStart(timeWindow: StatisticsTimeWindow) {
  const current = new Date();
  const next = new Date(current);

  if (timeWindow === "WEEK") {
    next.setDate(current.getDate() - 7);
  } else if (timeWindow === "MONTH") {
    next.setMonth(current.getMonth() - 1);
  } else {
    next.setFullYear(current.getFullYear() - 1);
  }

  return next.toISOString();
}

function upsertActivity(
  bucket: Map<string, ActivityPerformanceRow>,
  staffName: string,
  quantity: number,
  occurredAt: string | null,
) {
  const normalizedName = staffName.trim() || "Unassigned";
  const current = bucket.get(normalizedName);

  if (!current) {
    bucket.set(normalizedName, {
      id: normalizedName,
      staff_name: normalizedName,
      activity_count: 1,
      quantity,
      last_activity_at: occurredAt,
    });
    return;
  }

  current.activity_count += 1;
  current.quantity += quantity;
  if (occurredAt && (!current.last_activity_at || occurredAt > current.last_activity_at)) {
    current.last_activity_at = occurredAt;
  }
}

function sortActivityRows(rows: ActivityPerformanceRow[]) {
  return [...rows].sort((left, right) => {
    if (right.activity_count !== left.activity_count) {
      return right.activity_count - left.activity_count;
    }
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }
    return left.staff_name.localeCompare(right.staff_name);
  });
}

function buildReceivingRows(records: ReceiptRecord[]) {
  const bucket = new Map<string, ActivityPerformanceRow>();
  records.forEach((record) => {
    upsertActivity(
      bucket,
      record.received_by,
      sumQuantities(record.lines.map((line) => line.received_qty)),
      record.received_at,
    );
  });
  return sortActivityRows([...bucket.values()]);
}

function buildListingRows(records: PutawayTaskRecord[]) {
  const bucket = new Map<string, ActivityPerformanceRow>();
  records.forEach((record) => {
    upsertActivity(
      bucket,
      record.completed_by || record.assigned_to_name,
      parseQuantity(record.quantity),
      record.completed_at,
    );
  });
  return sortActivityRows([...bucket.values()]);
}

function buildPickingRows(records: PickTaskRecord[]) {
  const bucket = new Map<string, ActivityPerformanceRow>();
  records.forEach((record) => {
    upsertActivity(
      bucket,
      record.completed_by || record.assigned_to_name,
      parseQuantity(record.quantity),
      record.completed_at,
    );
  });
  return sortActivityRows([...bucket.values()]);
}

function buildPackingRows(records: PackageExecutionRecord[]) {
  const bucket = new Map<string, ActivityPerformanceRow>();
  records.forEach((record) => {
    upsertActivity(
      bucket,
      record.executed_by,
      parseQuantity(record.weight) || 1,
      record.executed_at,
    );
  });
  return sortActivityRows([...bucket.values()]);
}

function buildAfterSalesRows(
  receipts: ReturnReceiptRecord[],
  dispositions: ReturnDispositionRecord[],
) {
  const bucket = new Map<string, ActivityPerformanceRow>();
  receipts.forEach((record) => {
    upsertActivity(bucket, record.received_by, parseQuantity(record.received_qty), record.received_at);
  });
  dispositions.forEach((record) => {
    upsertActivity(bucket, record.completed_by, parseQuantity(record.quantity), record.completed_at);
  });
  return sortActivityRows([...bucket.values()]);
}

function buildStaffPerformanceRows(
  receivingRows: ActivityPerformanceRow[],
  listingRows: ActivityPerformanceRow[],
  pickingRows: ActivityPerformanceRow[],
  packingRows: ActivityPerformanceRow[],
  afterSalesRows: ActivityPerformanceRow[],
) {
  const bucket = new Map<string, StaffPerformanceRow>();

  const applyActivity = (
    rows: ActivityPerformanceRow[],
    field: keyof Pick<StaffPerformanceRow, "receiving" | "listing" | "picking" | "packing" | "after_sales">,
  ) => {
    rows.forEach((row) => {
      const current = bucket.get(row.staff_name) ?? {
        id: row.staff_name,
        staff_name: row.staff_name,
        receiving: 0,
        listing: 0,
        picking: 0,
        packing: 0,
        after_sales: 0,
        total_activities: 0,
        total_quantity: 0,
        last_activity_at: null,
      };

      current[field] = row.activity_count;
      current.total_activities += row.activity_count;
      current.total_quantity += row.quantity;
      if (row.last_activity_at && (!current.last_activity_at || row.last_activity_at > current.last_activity_at)) {
        current.last_activity_at = row.last_activity_at;
      }
      bucket.set(row.staff_name, current);
    });
  };

  applyActivity(receivingRows, "receiving");
  applyActivity(listingRows, "listing");
  applyActivity(pickingRows, "picking");
  applyActivity(packingRows, "packing");
  applyActivity(afterSalesRows, "after_sales");

  return [...bucket.values()].sort((left, right) => {
    if (right.total_activities !== left.total_activities) {
      return right.total_activities - left.total_activities;
    }
    if (right.total_quantity !== left.total_quantity) {
      return right.total_quantity - left.total_quantity;
    }
    return left.staff_name.localeCompare(right.staff_name);
  });
}

function buildWarehouseAnalysisRows(
  warehouses: WarehouseRecord[],
  balances: InventoryBalanceRecord[],
  standardPurchaseOrders: PurchaseOrderRecord[],
  salesOrders: SalesOrderRecord[],
  returnOrders: ReturnOrderRecord[],
) {
  return warehouses
    .map<WarehouseAnalysisRow>((warehouse) => ({
      id: String(warehouse.id),
      warehouse_name: warehouse.warehouse_name,
      on_hand_units: sumQuantities(
        balances.filter((record) => record.warehouse === warehouse.id).map((record) => record.on_hand_qty),
      ),
      standard_stock_in_orders: standardPurchaseOrders.filter((record) => record.warehouse === warehouse.id).length,
      stock_out_orders: salesOrders.filter((record) => record.warehouse === warehouse.id).length,
      direct_shipping_orders: salesOrders.filter(
        (record) => record.warehouse === warehouse.id && record.order_type === "DROPSHIP",
      ).length,
      after_sales_returns: returnOrders.filter((record) => record.warehouse === warehouse.id).length,
    }))
    .sort((left, right) => right.on_hand_units - left.on_hand_units);
}

export function useStatisticsController() {
  const { company, activeWarehouse, activeWarehouseId, warehouses } = useTenantScope();
  const [timeWindow, setTimeWindow] = useState<StatisticsTimeWindow>("MONTH");

  const rangeStart = useMemo(() => buildWindowStart(timeWindow), [timeWindow]);
  const warehouseQuery = activeWarehouseId ? { warehouse: activeWarehouseId } : {};

  const standardPurchaseOrdersQuery = usePaginatedResource<PurchaseOrderRecord>(
    ["statistics", "purchase-orders", "standard", activeWarehouseId, timeWindow],
    inboundApi.purchaseOrders,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      order_type: "STANDARD",
      create_time__gte: rangeStart,
    },
  );
  const standardAsnsQuery = usePaginatedResource<AdvanceShipmentNoticeRecord>(
    ["statistics", "asns", "standard", activeWarehouseId, timeWindow],
    inboundApi.advanceShipmentNotices,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      order_type: "STANDARD",
      create_time__gte: rangeStart,
    },
  );
  const receivingQuery = usePaginatedResource<ReceiptRecord>(
    ["statistics", "receipts", "standard", activeWarehouseId, timeWindow],
    inboundApi.receipts,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      order_type: "STANDARD",
      received_at__gte: rangeStart,
    },
  );
  const signingQuery = usePaginatedResource<InboundSigningRecord>(
    ["statistics", "signing-records", "standard", activeWarehouseId, timeWindow],
    inboundApi.signingRecords,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      order_type: "STANDARD",
      signed_at__gte: rangeStart,
    },
  );
  const listingQuery = usePaginatedResource<PutawayTaskRecord>(
    ["statistics", "putaway-tasks", "standard", activeWarehouseId, timeWindow],
    inboundApi.putawayTasks,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      order_type: "STANDARD",
      create_time__gte: rangeStart,
    },
  );
  const salesOrdersQuery = usePaginatedResource<SalesOrderRecord>(
    ["statistics", "sales-orders", activeWarehouseId, timeWindow],
    outboundApi.salesOrders,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      create_time__gte: rangeStart,
    },
  );
  const shipmentsQuery = usePaginatedResource<ShipmentRecord>(
    ["statistics", "shipments", activeWarehouseId, timeWindow],
    outboundApi.shipments,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      shipped_at__gte: rangeStart,
    },
  );
  const pickingQuery = usePaginatedResource<PickTaskRecord>(
    ["statistics", "pick-tasks", activeWarehouseId, timeWindow],
    outboundApi.pickTasks,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      create_time__gte: rangeStart,
    },
  );
  const packingQuery = usePaginatedResource<PackageExecutionRecord>(
    ["statistics", "package-executions", "pack", activeWarehouseId, timeWindow],
    outboundApi.packageExecutions,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      step_type: "PACK",
      executed_at__gte: rangeStart,
    },
  );
  const returnOrdersQuery = usePaginatedResource<ReturnOrderRecord>(
    ["statistics", "return-orders", activeWarehouseId, timeWindow],
    returnsApi.returnOrders,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      create_time__gte: rangeStart,
    },
  );
  const returnReceiptsQuery = usePaginatedResource<ReturnReceiptRecord>(
    ["statistics", "return-receipts", activeWarehouseId, timeWindow],
    returnsApi.receipts,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      received_at__gte: rangeStart,
    },
  );
  const returnDispositionsQuery = usePaginatedResource<ReturnDispositionRecord>(
    ["statistics", "return-dispositions", activeWarehouseId, timeWindow],
    returnsApi.dispositions,
    1,
    queryPageSize,
    {
      ...warehouseQuery,
      completed_at__gte: rangeStart,
    },
  );
  const balancesAllQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["statistics", "balances", "all-warehouses"],
    inventoryApi.balances,
    1,
    500,
  );
  const standardPurchaseOrdersAllWarehousesQuery = usePaginatedResource<PurchaseOrderRecord>(
    ["statistics", "purchase-orders", "standard", "all-warehouses", timeWindow],
    inboundApi.purchaseOrders,
    1,
    500,
    {
      order_type: "STANDARD",
      create_time__gte: rangeStart,
    },
  );
  const salesOrdersAllWarehousesQuery = usePaginatedResource<SalesOrderRecord>(
    ["statistics", "sales-orders", "all-warehouses", timeWindow],
    outboundApi.salesOrders,
    1,
    500,
    {
      create_time__gte: rangeStart,
    },
  );
  const returnOrdersAllWarehousesQuery = usePaginatedResource<ReturnOrderRecord>(
    ["statistics", "return-orders", "all-warehouses", timeWindow],
    returnsApi.returnOrders,
    1,
    500,
    {
      create_time__gte: rangeStart,
    },
  );

  const standardPurchaseOrders = standardPurchaseOrdersQuery.data?.results ?? [];
  const standardAsns = standardAsnsQuery.data?.results ?? [];
  const signingRecords = signingQuery.data?.results ?? [];
  const receipts = receivingQuery.data?.results ?? [];
  const putawayTasks = listingQuery.data?.results ?? [];
  const salesOrders = salesOrdersQuery.data?.results ?? [];
  const pickTasks = pickingQuery.data?.results ?? [];
  const shipments = shipmentsQuery.data?.results ?? [];
  const packSteps = packingQuery.data?.results ?? [];
  const returnOrders = returnOrdersQuery.data?.results ?? [];
  const returnReceipts = returnReceiptsQuery.data?.results ?? [];
  const returnDispositions = returnDispositionsQuery.data?.results ?? [];
  const allWarehouseBalances = balancesAllQuery.data?.results ?? [];
  const allWarehouseStandardPurchaseOrders = standardPurchaseOrdersAllWarehousesQuery.data?.results ?? [];
  const allWarehouseSalesOrders = salesOrdersAllWarehousesQuery.data?.results ?? [];
  const allWarehouseReturnOrders = returnOrdersAllWarehousesQuery.data?.results ?? [];

  const directShippingOrders = useMemo(
    () => salesOrders.filter((record) => record.order_type === "DROPSHIP"),
    [salesOrders],
  );
  const directShippingShipments = useMemo(
    () => shipments.filter((record) => record.order_type === "DROPSHIP"),
    [shipments],
  );
  const directShippingPackSteps = useMemo(
    () => packSteps.filter((record) => record.order_type === "DROPSHIP"),
    [packSteps],
  );

  const receivingRows = useMemo(() => buildReceivingRows(receipts), [receipts]);
  const listingRows = useMemo(() => buildListingRows(putawayTasks), [putawayTasks]);
  const pickingRows = useMemo(() => buildPickingRows(pickTasks), [pickTasks]);
  const packingRows = useMemo(() => buildPackingRows(packSteps), [packSteps]);
  const afterSalesRows = useMemo(
    () => buildAfterSalesRows(returnReceipts, returnDispositions),
    [returnDispositions, returnReceipts],
  );
  const staffPerformanceRows = useMemo(
    () =>
      buildStaffPerformanceRows(
        receivingRows,
        listingRows,
        pickingRows,
        packingRows,
        afterSalesRows,
      ),
    [afterSalesRows, listingRows, packingRows, pickingRows, receivingRows],
  );

  const stockInOutRows = useMemo<StatisticsFlowRow[]>(
    () => [
      {
        id: "standard-stock-in",
        segment: "Standard Stock-in",
        documents:
          (standardPurchaseOrdersQuery.data?.count ?? 0) +
          (standardAsnsQuery.data?.count ?? 0) +
          (receivingQuery.data?.count ?? 0),
        units: sumPurchaseOrderUnits(standardPurchaseOrders) + sumReceiptUnits(receipts),
        completed_documents: signingQuery.data?.count ?? 0,
        completed_units: sumQuantities(putawayTasks.map((record) => record.quantity)),
        focus: "Inbound flow",
      },
      {
        id: "stock-out",
        segment: "Stock Out Statistics",
        documents: (salesOrdersQuery.data?.count ?? 0) + (shipmentsQuery.data?.count ?? 0),
        units: sumSalesOrderUnits(salesOrders),
        completed_documents: shipmentsQuery.data?.count ?? 0,
        completed_units: sumShipmentUnits(shipments),
        focus: "Outbound flow",
      },
      {
        id: "after-sales",
        segment: "After Sales",
        documents:
          (returnOrdersQuery.data?.count ?? 0) +
          (returnReceiptsQuery.data?.count ?? 0) +
          (returnDispositionsQuery.data?.count ?? 0),
        units: sumReturnOrderUnits(returnOrders),
        completed_documents: returnDispositionsQuery.data?.count ?? 0,
        completed_units: sumQuantities(returnDispositions.map((record) => record.quantity)),
        focus: "Reverse logistics",
      },
      {
        id: "direct-shipping",
        segment: "Direct Shipping",
        documents: directShippingOrders.length + directShippingShipments.length,
        units: sumSalesOrderUnits(directShippingOrders),
        completed_documents: directShippingShipments.length,
        completed_units: sumShipmentUnits(directShippingShipments),
        focus: "Dropship orders",
      },
    ],
    [
      directShippingOrders,
      directShippingShipments,
      putawayTasks,
      receipts,
      returnDispositions,
      returnDispositionsQuery.data?.count,
      returnOrders,
      returnOrdersQuery.data?.count,
      returnReceiptsQuery.data?.count,
      salesOrders,
      salesOrdersQuery.data?.count,
      shipments,
      shipmentsQuery.data?.count,
      signingQuery.data?.count,
      standardAsnsQuery.data?.count,
      standardPurchaseOrders,
      standardPurchaseOrdersQuery.data?.count,
      receivingQuery.data?.count,
    ],
  );

  const standardStockInRows = useMemo<StatisticsFlowRow[]>(
    () => [
      {
        id: "purchase-orders",
        segment: "Purchase orders",
        documents: standardPurchaseOrdersQuery.data?.count ?? 0,
        units: sumPurchaseOrderUnits(standardPurchaseOrders),
        completed_documents: standardPurchaseOrders.filter((record) => record.status === "CLOSED").length,
        completed_units: sumQuantities(
          standardPurchaseOrders.flatMap((record) => record.lines.map((line) => line.received_qty)),
        ),
        focus: "Inbound planning",
      },
      {
        id: "advance-shipment-notices",
        segment: "Advance shipment notices",
        documents: standardAsnsQuery.data?.count ?? 0,
        units: 0,
        completed_documents: standardAsns.filter((record) => record.status === "RECEIVED").length,
        completed_units: 0,
        focus: "Supplier transit",
      },
      {
        id: "receiving",
        segment: "Receiving",
        documents: receivingQuery.data?.count ?? 0,
        units: sumReceiptUnits(receipts),
        completed_documents: signingQuery.data?.count ?? 0,
        completed_units: sumReceiptUnits(receipts),
        focus: "Dock intake",
      },
      {
        id: "listing",
        segment: "Listing",
        documents: listingQuery.data?.count ?? 0,
        units: sumQuantities(putawayTasks.map((record) => record.quantity)),
        completed_documents: putawayTasks.filter((record) => record.status === "COMPLETED").length,
        completed_units: sumQuantities(
          putawayTasks.filter((record) => record.status === "COMPLETED").map((record) => record.quantity),
        ),
        focus: "Putaway completion",
      },
    ],
    [
      standardAsns,
      standardAsnsQuery.data?.count,
      standardPurchaseOrders,
      standardPurchaseOrdersQuery.data?.count,
      signingQuery.data?.count,
      receipts,
      receivingQuery.data?.count,
      putawayTasks,
      listingQuery.data?.count,
    ],
  );

  const stockOutRows = useMemo<StatisticsFlowRow[]>(
    () => [
      {
        id: "sales-orders",
        segment: "Sales orders",
        documents: salesOrdersQuery.data?.count ?? 0,
        units: sumSalesOrderUnits(salesOrders),
        completed_documents: salesOrders.filter((record) => record.status === "SHIPPED").length,
        completed_units: sumQuantities(
          salesOrders.flatMap((record) => record.lines.map((line) => line.shipped_qty)),
        ),
        focus: "Order demand",
      },
      {
        id: "picking",
        segment: "Picking",
        documents: pickingQuery.data?.count ?? 0,
        units: sumQuantities(pickTasks.map((record) => record.quantity)),
        completed_documents: pickTasks.filter((record) => record.status === "COMPLETED").length,
        completed_units: sumQuantities(
          pickTasks.filter((record) => record.status === "COMPLETED").map((record) => record.quantity),
        ),
        focus: "Warehouse pick execution",
      },
      {
        id: "packing",
        segment: "Packing",
        documents: packingQuery.data?.count ?? 0,
        units: packSteps.length,
        completed_documents: packSteps.filter((record) => record.execution_status === "SUCCESS").length,
        completed_units: packSteps.filter((record) => record.execution_status === "SUCCESS").length,
        focus: "Pack verification",
      },
      {
        id: "shipments",
        segment: "Shipments",
        documents: shipmentsQuery.data?.count ?? 0,
        units: sumShipmentUnits(shipments),
        completed_documents: shipments.filter((record) => record.status === "POSTED").length,
        completed_units: sumShipmentUnits(shipments.filter((record) => record.status === "POSTED")),
        focus: "Released stock-out",
      },
    ],
    [
      salesOrders,
      salesOrdersQuery.data?.count,
      pickTasks,
      pickingQuery.data?.count,
      packSteps,
      packingQuery.data?.count,
      shipments,
      shipmentsQuery.data?.count,
    ],
  );

  const afterSalesStatisticsRows = useMemo<StatisticsFlowRow[]>(
    () => [
      {
        id: "return-orders",
        segment: "Return orders",
        documents: returnOrdersQuery.data?.count ?? 0,
        units: sumReturnOrderUnits(returnOrders),
        completed_documents: returnOrders.filter((record) => record.status === "COMPLETED").length,
        completed_units: sumQuantities(
          returnOrders.flatMap((record) => record.lines.map((line) => line.disposed_qty)),
        ),
        focus: "Customer after sales",
      },
      {
        id: "return-receipts",
        segment: "Receiving",
        documents: returnReceiptsQuery.data?.count ?? 0,
        units: sumQuantities(returnReceipts.map((record) => record.received_qty)),
        completed_documents: returnReceiptsQuery.data?.count ?? 0,
        completed_units: sumQuantities(returnReceipts.map((record) => record.received_qty)),
        focus: "Reverse receiving",
      },
      {
        id: "return-dispositions",
        segment: "Disposition",
        documents: returnDispositionsQuery.data?.count ?? 0,
        units: sumQuantities(returnDispositions.map((record) => record.quantity)),
        completed_documents: returnDispositionsQuery.data?.count ?? 0,
        completed_units: sumQuantities(returnDispositions.map((record) => record.quantity)),
        focus: "Restock and quarantine",
      },
    ],
    [
      returnDispositions,
      returnDispositionsQuery.data?.count,
      returnOrders,
      returnOrdersQuery.data?.count,
      returnReceipts,
      returnReceiptsQuery.data?.count,
    ],
  );

  const directShippingRows = useMemo<StatisticsFlowRow[]>(
    () => [
      {
        id: "direct-orders",
        segment: "Direct Shipping",
        documents: directShippingOrders.length,
        units: sumSalesOrderUnits(directShippingOrders),
        completed_documents: directShippingOrders.filter((record) => record.status === "SHIPPED").length,
        completed_units: sumQuantities(
          directShippingOrders.flatMap((record) => record.lines.map((line) => line.shipped_qty)),
        ),
        focus: "Dropship order mix",
      },
      {
        id: "direct-packing",
        segment: "Packing",
        documents: directShippingPackSteps.length,
        units: directShippingPackSteps.length,
        completed_documents: directShippingPackSteps.filter((record) => record.execution_status === "SUCCESS").length,
        completed_units: directShippingPackSteps.filter((record) => record.execution_status === "SUCCESS").length,
        focus: "Pack release",
      },
      {
        id: "direct-shipped",
        segment: "Shipped",
        documents: directShippingShipments.length,
        units: sumShipmentUnits(directShippingShipments),
        completed_documents: directShippingShipments.filter((record) => record.status === "POSTED").length,
        completed_units: sumShipmentUnits(
          directShippingShipments.filter((record) => record.status === "POSTED"),
        ),
        focus: "Direct shipping completion",
      },
      {
        id: "direct-exception",
        segment: "Exceptions",
        documents: directShippingOrders.filter((record) => record.exception_state && record.exception_state !== "NORMAL").length,
        units: 0,
        completed_documents: directShippingOrders.filter((record) => record.fulfillment_stage === "TO_SHIP").length,
        completed_units: 0,
        focus: "Abnormal and intercepted",
      },
    ],
    [directShippingOrders, directShippingPackSteps, directShippingShipments],
  );

  const warehouseAnalysisRows = useMemo(
    () =>
      buildWarehouseAnalysisRows(
        warehouses,
        allWarehouseBalances,
        allWarehouseStandardPurchaseOrders,
        allWarehouseSalesOrders,
        allWarehouseReturnOrders,
      ),
    [
      allWarehouseBalances,
      allWarehouseReturnOrders,
      allWarehouseSalesOrders,
      allWarehouseStandardPurchaseOrders,
      warehouses,
    ],
  );

  const summary = useMemo(() => {
    const topPerformer = staffPerformanceRows[0] ?? null;
    return {
      currentPeriod: timeWindow,
      inboundDocuments:
        (standardPurchaseOrdersQuery.data?.count ?? 0) +
        (standardAsnsQuery.data?.count ?? 0) +
        (receivingQuery.data?.count ?? 0),
      outboundDocuments: (salesOrdersQuery.data?.count ?? 0) + (shipmentsQuery.data?.count ?? 0),
      directShippingOrders: directShippingOrders.length,
      afterSalesOrders: returnOrdersQuery.data?.count ?? 0,
      onHandUnits: sumQuantities(allWarehouseBalances.map((record) => record.on_hand_qty)),
      activeWarehouses: warehouseAnalysisRows.filter(
        (row) =>
          row.on_hand_units > 0 ||
          row.standard_stock_in_orders > 0 ||
          row.stock_out_orders > 0 ||
          row.after_sales_returns > 0,
      ).length,
      activeStaff: staffPerformanceRows.length,
      topPerformer,
    };
  }, [
    allWarehouseBalances,
    directShippingOrders.length,
    receivingQuery.data?.count,
    returnOrdersQuery.data?.count,
    salesOrdersQuery.data?.count,
    shipmentsQuery.data?.count,
    staffPerformanceRows,
    standardAsnsQuery.data?.count,
    standardPurchaseOrdersQuery.data?.count,
    timeWindow,
    warehouseAnalysisRows,
  ]);

  return {
    company,
    activeWarehouse,
    warehouses,
    timeWindow,
    setTimeWindow,
    standardPurchaseOrdersQuery,
    standardAsnsQuery,
    signingQuery,
    receivingQuery,
    listingQuery,
    salesOrdersQuery,
    pickingQuery,
    packingQuery,
    shipmentsQuery,
    returnOrdersQuery,
    returnReceiptsQuery,
    returnDispositionsQuery,
    warehouseAnalysisQuery: {
      isLoading:
        balancesAllQuery.isLoading ||
        standardPurchaseOrdersAllWarehousesQuery.isLoading ||
        salesOrdersAllWarehousesQuery.isLoading ||
        returnOrdersAllWarehousesQuery.isLoading,
      error:
        balancesAllQuery.error ??
        standardPurchaseOrdersAllWarehousesQuery.error ??
        salesOrdersAllWarehousesQuery.error ??
        returnOrdersAllWarehousesQuery.error,
    },
    stockInOutRows,
    standardStockInRows,
    stockOutRows,
    warehouseAnalysisRows,
    staffPerformanceRows,
    receivingRows,
    listingRows,
    pickingRows,
    packingRows,
    afterSalesRows,
    afterSalesStatisticsRows,
    directShippingRows,
    summary,
  };
}
