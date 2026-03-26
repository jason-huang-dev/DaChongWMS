import { useEffect, useMemo, useState } from "react";

import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import type {
  IntegrationJobRecord,
  InventoryBalanceRecord,
  LocationRecord,
  OutboundWaveRecord,
  PurchaseOrderRecord,
  ReturnOrderRecord,
  ReturnReceiptRecord,
  SalesOrderRecord,
  ShipmentRecord,
  WarehouseRecord,
  WebhookEventRecord,
} from "@/shared/types/domain";
import type { ReferenceOption } from "@/shared/types/options";

const referencePageSize = 100;

interface ReferenceListConfig {
  enabled?: boolean;
  pageSize?: number;
  searchQuery?: (term: string) => Record<string, string | number | boolean | null | undefined>;
}

export interface ReferenceListState<TValue extends string | number = number, TRecord = unknown> {
  options: ReferenceOption<TValue, TRecord>[];
  query: UseInfiniteQueryResult<InfiniteData<PaginatedResponse<TRecord>, unknown>, Error>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  loadMore: () => void;
  hasMore: boolean;
}

function defaultSearchQuery(term: string) {
  return { search: term };
}

function useReferenceList<TRecord>(
  queryKey: readonly unknown[],
  path: string,
  buildOption: (record: TRecord) => ReferenceOption<number, TRecord>,
  extraQuery?: Record<string, string | number | boolean | null | undefined>,
  config?: ReferenceListConfig,
) {
  const [searchTerm, setSearchTerm] = useState("");
  const dependencyKey = JSON.stringify([queryKey, extraQuery ?? {}]);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const pageSize = config?.pageSize ?? referencePageSize;
  const searchQuery = debouncedSearchTerm
    ? (config?.searchQuery ?? defaultSearchQuery)(debouncedSearchTerm)
    : undefined;

  useEffect(() => {
    setSearchTerm("");
  }, [dependencyKey]);

  const query = useInfiniteQuery({
    queryKey: [...queryKey, extraQuery ?? {}, searchQuery ?? {}, pageSize],
    queryFn: ({ pageParam }) =>
      apiGet<PaginatedResponse<TRecord>>(path, {
        page: Number(pageParam),
        page_size: pageSize,
        ...extraQuery,
        ...searchQuery,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
    enabled: config?.enabled,
  });

  const options = useMemo(
    () =>
      (query.data?.pages ?? [])
        .flatMap((page) => page.results)
        .map((record) => buildOption(record))
        .filter((option, index, array) => array.findIndex((candidate) => candidate.value === option.value) === index),
    [buildOption, query.data?.pages],
  );

  return {
    options,
    query,
    searchTerm,
    setSearchTerm,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    hasMore: Boolean(query.hasNextPage),
  } satisfies ReferenceListState<number, TRecord>;
}

export function useWarehouseReferenceOptions() {
  return useReferenceList<WarehouseRecord>(
    ["references", "warehouses"],
    "/api/warehouse/",
    (warehouse) => ({
      value: warehouse.id,
      label: warehouse.warehouse_name,
      description: warehouse.warehouse_city || warehouse.warehouse_address,
      record: warehouse,
    }),
    undefined,
    {
      searchQuery: (term) => ({ warehouse_name__icontains: term }),
    },
  );
}

export function useLocationReferenceOptions(warehouseId?: number | null) {
  return useReferenceList<LocationRecord>(
    ["references", "locations", warehouseId ?? "all"],
    "/api/locations/",
    (location) => ({
      value: location.id,
      label: location.location_code,
      description: `${location.zone_code} · ${location.location_type_code} · ${location.status}`,
      record: location,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
  );
}

export function useInventoryBalanceReferenceOptions(warehouseId?: number | null, config?: ReferenceListConfig) {
  return useReferenceList<InventoryBalanceRecord>(
    ["references", "inventory-balances", warehouseId ?? "all"],
    "/api/inventory/balances/",
    (balance) => ({
      value: balance.id,
      label: `${balance.goods_code} @ ${balance.location_code}`,
      description: `${balance.available_qty} available · ${balance.stock_status}`,
      record: balance,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
    config,
  );
}

export function usePurchaseOrderReferenceOptions(warehouseId?: number | null, orderType?: string | null) {
  return useReferenceList<PurchaseOrderRecord>(
    ["references", "purchase-orders", warehouseId ?? "all", orderType ?? "all"],
    "/api/inbound/purchase-orders/",
    (purchaseOrder) => ({
      value: purchaseOrder.id,
      label: purchaseOrder.po_number,
      description: `${purchaseOrder.supplier_name} · ${purchaseOrder.status}`,
      record: purchaseOrder,
    }),
    warehouseId || orderType ? { warehouse: warehouseId ?? undefined, order_type: orderType ?? undefined } : undefined,
  );
}

export function useSalesOrderReferenceOptions(warehouseId?: number | null, orderType?: string | null) {
  return useReferenceList<SalesOrderRecord>(
    ["references", "sales-orders", warehouseId ?? "all", orderType ?? "all"],
    "/api/outbound/sales-orders/",
    (salesOrder) => ({
      value: salesOrder.id,
      label: salesOrder.order_number,
      description: `${salesOrder.customer_name} · ${salesOrder.status}`,
      record: salesOrder,
    }),
    warehouseId || orderType ? { warehouse: warehouseId ?? undefined, order_type: orderType ?? undefined } : undefined,
  );
}

export function useReturnOrderReferenceOptions(warehouseId?: number | null) {
  return useReferenceList<ReturnOrderRecord>(
    ["references", "return-orders", warehouseId ?? "all"],
    "/api/returns/return-orders/",
    (returnOrder) => ({
      value: returnOrder.id,
      label: returnOrder.return_number,
      description: `${returnOrder.customer_name} · ${returnOrder.status}`,
      record: returnOrder,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
  );
}

export function useReturnReceiptReferenceOptions(warehouseId?: number | null) {
  return useReferenceList<ReturnReceiptRecord>(
    ["references", "return-receipts", warehouseId ?? "all"],
    "/api/returns/receipts/",
    (receipt) => ({
      value: receipt.id,
      label: receipt.receipt_number,
      description: `${receipt.return_number} · ${receipt.goods_code}`,
      record: receipt,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
  );
}

export function useShipmentReferenceOptions(warehouseId?: number | null, orderType?: string | null) {
  return useReferenceList<ShipmentRecord>(
    ["references", "shipments", warehouseId ?? "all", orderType ?? "all"],
    "/api/outbound/shipments/",
    (shipment) => ({
      value: shipment.id,
      label: shipment.shipment_number,
      description: `${shipment.order_number} · ${shipment.status}`,
      record: shipment,
    }),
    warehouseId || orderType ? { warehouse: warehouseId ?? undefined, order_type: orderType ?? undefined } : undefined,
  );
}

export function useWaveReferenceOptions(warehouseId?: number | null, orderType?: string | null) {
  return useReferenceList<OutboundWaveRecord>(
    ["references", "outbound-waves", warehouseId ?? "all", orderType ?? "all"],
    "/api/outbound/waves/",
    (wave) => ({
      value: wave.id,
      label: wave.wave_number,
      description: `${wave.order_count} orders · ${wave.status}`,
      record: wave,
    }),
    warehouseId || orderType ? { warehouse: warehouseId ?? undefined, order_type: orderType ?? undefined } : undefined,
  );
}

export function useWebhookReferenceOptions(warehouseId?: number | null) {
  return useReferenceList<WebhookEventRecord>(
    ["references", "webhooks", warehouseId ?? "all"],
    "/api/integrations/webhooks/",
    (webhook) => ({
      value: webhook.id,
      label: webhook.event_key,
      description: `${webhook.source_system} · ${webhook.status}`,
      record: webhook,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
  );
}

export function useCustomerReferenceOptions(warehouseId?: number | null) {
  const salesOrders = useSalesOrderReferenceOptions(warehouseId);
  const returnOrders = useReturnOrderReferenceOptions(warehouseId);

  const options = useMemo(() => {
    const customerMap = new Map<number, ReferenceOption<number, { customerId: number; customerName: string }>>();

    for (const option of salesOrders.options) {
      const record = option.record;
      if (!customerMap.has(record.customer)) {
        customerMap.set(record.customer, {
          value: record.customer,
          label: record.customer_name,
          description: `Outbound customer from ${record.order_number}`,
          record: { customerId: record.customer, customerName: record.customer_name },
        });
      }
    }

    for (const option of returnOrders.options) {
      const record = option.record;
      if (!customerMap.has(record.customer)) {
        customerMap.set(record.customer, {
          value: record.customer,
          label: record.customer_name,
          description: `Returns customer from ${record.return_number}`,
          record: { customerId: record.customer, customerName: record.customer_name },
        });
      }
    }

    return Array.from(customerMap.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [returnOrders.options, salesOrders.options]);

  return {
    options,
    query: {
      data: undefined,
      error: salesOrders.query.error ?? returnOrders.query.error,
      isLoading: salesOrders.query.isLoading || returnOrders.query.isLoading,
    },
  };
}

export function useIntegrationJobReferenceOptions(warehouseId?: number | null) {
  return useReferenceList<IntegrationJobRecord>(
    ["references", "integration-jobs", warehouseId ?? "all"],
    "/api/integrations/jobs/",
    (job) => ({
      value: job.id,
      label: job.reference_code || `${job.integration_name} #${job.id}`,
      description: `${job.integration_name} · ${job.status}`,
      record: job,
    }),
    warehouseId ? { warehouse: warehouseId } : undefined,
  );
}
