import type { ClientAccountRecord } from "@/features/clients/model/types";
import type {
  InventoryInformationAreaKey,
  InventoryInformationAreaOption,
  InventoryInformationClient,
  InventoryInformationImportApiRow,
  InventoryInformationImportResult,
  InventoryInformationRow,
  InventoryInformationSortKey,
} from "@/features/inventory/model/types";
import type { DistributionProductRecord, ProductRecord } from "@/features/products/model/types";
import type {
  InventoryBalanceRecord,
  LocationRecord,
  PurchaseOrderRecord,
  PutawayTaskRecord,
  SalesOrderRecord,
} from "@/shared/types/domain";
import { downloadCsvFile, escapeCsvValue } from "@/shared/utils/csv";

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeComparableText(value: unknown) {
  const normalizedValue = normalizeText(value);

  try {
    return normalizedValue.normalize("NFC");
  } catch {
    return normalizedValue;
  }
}

function normalizeUpperText(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeShelf(value: unknown) {
  return normalizeUpperText(value);
}

function normalizeLocationCode(value: unknown) {
  return normalizeUpperText(value);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveDifference(total: string, completed: string) {
  return Math.max(toNumber(total) - toNumber(completed), 0);
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareDatesAscending(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

const inventoryInformationTextCollator = new Intl.Collator(undefined, {
  ignorePunctuation: true,
  numeric: true,
  sensitivity: "base",
  usage: "sort",
});

export function compareInventoryInformationText(left: unknown, right: unknown) {
  return inventoryInformationTextCollator.compare(normalizeComparableText(left), normalizeComparableText(right));
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).sort(compareInventoryInformationText);
}

function buildWarehouseSkuKey(warehouseName: string, merchantSku: string) {
  return `${normalizeUpperText(warehouseName)}::${normalizeUpperText(merchantSku)}`;
}

function isCancelledStatus(value: string) {
  return normalizeUpperText(value) === "CANCELLED";
}

function isClosedStatus(value: string) {
  return ["CLOSED", "COMPLETED", "DONE", "RECEIVED"].includes(normalizeUpperText(value));
}

function isDefectiveStockStatus(value: string) {
  const normalized = normalizeUpperText(value);
  return ["DEFECT", "DEFECTIVE", "DAMAGED", "QC", "QUARANTINE", "RETURN"].some((keyword) => normalized.includes(keyword));
}

function buildInventoryInformationClient(code: string, clientNameByCode: Map<string, string>) {
  const normalizedCode = normalizeUpperText(code);
  if (!normalizedCode) {
    return null;
  }

  const name = clientNameByCode.get(normalizedCode) ?? "";
  return {
    code: normalizedCode,
    name,
    label: name ? `${name} [${normalizedCode}]` : normalizedCode,
  } satisfies InventoryInformationClient;
}

function sortInventoryInformationClients(clients: InventoryInformationClient[]) {
  return [...clients].sort((left, right) => compareInventoryInformationText(left.label, right.label));
}

function mergeClients(...clientGroups: InventoryInformationClient[][]) {
  const clientsByCode = new Map<string, InventoryInformationClient>();

  clientGroups.flat().forEach((client) => {
    if (client.code) {
      clientsByCode.set(client.code, client);
    }
  });

  return sortInventoryInformationClients(Array.from(clientsByCode.values()));
}

function findInventoryInformationClientByCode(clients: InventoryInformationClient[], code: string) {
  const normalizedCode = normalizeUpperText(code);
  return clients.find((client) => client.code === normalizedCode) ?? null;
}

function resolvePrimaryInventoryInformationClient(
  explicitCustomerCode: string,
  preferredClient: InventoryInformationClient | null,
  clients: InventoryInformationClient[],
  clientNameByCode: Map<string, string>,
) {
  const explicitClient =
    findInventoryInformationClientByCode(clients, explicitCustomerCode) ??
    buildInventoryInformationClient(explicitCustomerCode, clientNameByCode);

  return explicitClient ?? preferredClient ?? clients[0] ?? null;
}

interface InventoryInformationMetricAggregate {
  total: number;
  byClientCode: Map<string, number>;
  clientCodes: Set<string>;
}

function createMetricAggregate(): InventoryInformationMetricAggregate {
  return {
    total: 0,
    byClientCode: new Map<string, number>(),
    clientCodes: new Set<string>(),
  };
}

function accumulateAggregate(
  lookup: Map<string, InventoryInformationMetricAggregate>,
  warehouseName: string,
  merchantSku: string,
  customerCode: string,
  quantity: number,
) {
  if (!quantity) {
    return;
  }

  const key = buildWarehouseSkuKey(warehouseName, merchantSku);
  const current = lookup.get(key) ?? createMetricAggregate();
  current.total += quantity;

  const normalizedCustomerCode = normalizeUpperText(customerCode);
  if (normalizedCustomerCode) {
    current.clientCodes.add(normalizedCustomerCode);
    current.byClientCode.set(normalizedCustomerCode, (current.byClientCode.get(normalizedCustomerCode) ?? 0) + quantity);
  }

  lookup.set(key, current);
}

function resolveAggregateQuantity(
  aggregate: InventoryInformationMetricAggregate | undefined,
  explicitCustomerCode: string,
  fallbackQuantity: number,
) {
  if (!aggregate) {
    return fallbackQuantity;
  }

  const normalizedCustomerCode = normalizeUpperText(explicitCustomerCode);
  if (normalizedCustomerCode) {
    return aggregate.byClientCode.get(normalizedCustomerCode) ?? 0;
  }

  return Math.max(fallbackQuantity, aggregate.total);
}

function buildClientNameByCode(clientAccounts: ClientAccountRecord[]) {
  return new Map(
    clientAccounts.map((clientAccount) => [normalizeUpperText(clientAccount.code), normalizeText(clientAccount.name)] as const),
  );
}

interface InventoryInformationDistributionMetadata {
  merchantCode: string;
  client: InventoryInformationClient | null;
}

function buildDistributionMetadataBySku(
  distributionProducts: DistributionProductRecord[],
  products: ProductRecord[],
  clientNameByCode: Map<string, string>,
) {
  const skuByProductId = new Map(products.map((product) => [product.id, normalizeUpperText(product.sku)] as const));
  const metadataBySku = new Map<string, InventoryInformationDistributionMetadata>();

  distributionProducts.forEach((distributionProduct) => {
    if (!distributionProduct.is_active) {
      return;
    }

    const merchantSku = skuByProductId.get(distributionProduct.product_id);
    if (!merchantSku) {
      return;
    }

    if (metadataBySku.has(merchantSku)) {
      return;
    }

    const client = buildInventoryInformationClient(distributionProduct.customer_account_code, clientNameByCode);

    metadataBySku.set(merchantSku, {
      merchantCode: normalizeText(distributionProduct.external_sku),
      client,
    });
  });

  return metadataBySku;
}

function buildPendingReceivalLookup(purchaseOrders: PurchaseOrderRecord[]) {
  const lookup = new Map<string, InventoryInformationMetricAggregate>();

  purchaseOrders.forEach((purchaseOrder) => {
    if (isCancelledStatus(purchaseOrder.status) || isClosedStatus(purchaseOrder.status)) {
      return;
    }

    const customerCode = normalizeUpperText(purchaseOrder.customer_code);

    purchaseOrder.lines.forEach((line) => {
      if (isCancelledStatus(line.status) || isClosedStatus(line.status)) {
        return;
      }

      const pendingReceival = toPositiveDifference(line.ordered_qty, line.received_qty);
      accumulateAggregate(lookup, purchaseOrder.warehouse_name, line.goods_code, customerCode, pendingReceival);
    });
  });

  return lookup;
}

function buildOrderAllocatedLookup(salesOrders: SalesOrderRecord[]) {
  const lookup = new Map<string, InventoryInformationMetricAggregate>();

  salesOrders.forEach((salesOrder) => {
    if (isCancelledStatus(salesOrder.status) || isClosedStatus(salesOrder.status)) {
      return;
    }

    const customerCode = normalizeUpperText(salesOrder.customer_code);

    salesOrder.lines.forEach((line) => {
      if (isCancelledStatus(line.status) || isClosedStatus(line.status)) {
        return;
      }

      accumulateAggregate(lookup, salesOrder.warehouse_name, line.goods_code, customerCode, toNumber(line.allocated_qty));
    });
  });

  return lookup;
}

function buildInTransitLookup(putawayTasks: PutawayTaskRecord[]) {
  const lookup = new Map<string, InventoryInformationMetricAggregate>();

  putawayTasks.forEach((putawayTask) => {
    if (isCancelledStatus(putawayTask.status) || isClosedStatus(putawayTask.status)) {
      return;
    }

    accumulateAggregate(lookup, putawayTask.warehouse_name, putawayTask.goods_code, "", toNumber(putawayTask.quantity));
  });

  return lookup;
}

function buildImportedMerchantCodeByWarehouseSku(rows: InventoryInformationRow[]) {
  const lookup = new Map<string, string>();

  rows.forEach((row) => {
    const key = buildWarehouseSkuKey(row.warehouseName, row.merchantSku);
    const merchantCode = normalizeText(row.merchantCode);
    if (merchantCode && !lookup.has(key)) {
      lookup.set(key, merchantCode);
    }
  });

  return lookup;
}

function buildImportedClientsByWarehouseSku(rows: InventoryInformationRow[], clientNameByCode: Map<string, string>) {
  const lookup = new Map<string, InventoryInformationClient[]>();

  rows.forEach((row) => {
    const key = buildWarehouseSkuKey(row.warehouseName, row.merchantSku);
    const existingClients = lookup.get(key) ?? [];
    const importedClients = uniqueSorted([row.customerCode, ...row.clients.map((client) => client.code)])
      .map((code) => buildInventoryInformationClient(code, clientNameByCode))
      .filter((client): client is InventoryInformationClient => client !== null);
    lookup.set(key, mergeClients(existingClients, importedClients));
  });

  return lookup;
}

type InventoryInformationQueryField =
  | "areaKey"
  | "merchantSku"
  | "productName"
  | "merchantCode"
  | "client"
  | "clientCode"
  | "warehouseName"
  | "tag"
  | "barcode"
  | "brand"
  | "category"
  | "shelf"
  | "zoneCode"
  | "locationTypeCode"
  | "source"
  | "stockStatus"
  | "availableStock"
  | "orderAllocated"
  | "pendingReceival"
  | "inTransit"
  | "toList"
  | "defectiveProducts"
  | "totalInventory";

interface InventoryInformationQueryFieldDefinition {
  aliases: string[];
  matchMode: "exact" | "contains";
  readAll: (row: InventoryInformationRow) => string[];
}

function numericFieldValue(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

const inventoryInformationQueryFieldDefinitions: Record<
  InventoryInformationQueryField,
  InventoryInformationQueryFieldDefinition
> = {
  areaKey: {
    aliases: ["area"],
    matchMode: "exact",
    readAll: (row) => [row.areaKey, row.areaLabel],
  },
  merchantSku: {
    aliases: ["sku", "merchantsku", "merchant_sku"],
    matchMode: "exact",
    readAll: (row) => [row.merchantSku],
  },
  productName: {
    aliases: ["product", "name", "productname", "product_name"],
    matchMode: "contains",
    readAll: (row) => [row.productName, row.productBarcode, row.productDescription],
  },
  merchantCode: {
    aliases: ["merchant", "merchantcode", "merchant_code", "code"],
    matchMode: "contains",
    readAll: (row) => [row.merchantCode],
  },
  client: {
    aliases: ["client", "customer"],
    matchMode: "contains",
    readAll: (row) => [
      row.customerCode,
      ...row.clients.flatMap((client) => [client.code, client.name, client.label]),
    ],
  },
  clientCode: {
    aliases: ["clientcode", "client_code", "clientid", "client_id", "customercode", "customer_code"],
    matchMode: "contains",
    readAll: (row) => [row.customerCode, ...row.clients.map((client) => client.code)],
  },
  warehouseName: {
    aliases: ["warehouse"],
    matchMode: "contains",
    readAll: (row) => [row.warehouseName],
  },
  tag: {
    aliases: ["tag", "tags"],
    matchMode: "contains",
    readAll: (row) => row.productTags,
  },
  barcode: {
    aliases: ["barcode"],
    matchMode: "contains",
    readAll: (row) => [row.productBarcode],
  },
  brand: {
    aliases: ["brand"],
    matchMode: "contains",
    readAll: (row) => [row.productBrand],
  },
  category: {
    aliases: ["category"],
    matchMode: "contains",
    readAll: (row) => [row.productCategory],
  },
  shelf: {
    aliases: ["shelf", "location", "bin"],
    matchMode: "contains",
    readAll: (row) => [row.shelf, ...row.shelves],
  },
  zoneCode: {
    aliases: ["zone", "zonecode", "zone_code"],
    matchMode: "contains",
    readAll: (row) => [row.zoneCode, ...row.zoneCodes],
  },
  locationTypeCode: {
    aliases: ["type", "locationtype", "location_type"],
    matchMode: "contains",
    readAll: (row) => [row.locationTypeCode, ...row.locationTypeCodes],
  },
  source: {
    aliases: ["source"],
    matchMode: "exact",
    readAll: (row) => [row.source],
  },
  stockStatus: {
    aliases: ["status", "stockstatus", "stock_status"],
    matchMode: "contains",
    readAll: (row) => [row.stockStatus, ...row.stockStatuses],
  },
  availableStock: {
    aliases: ["available", "availablestock", "available_stock"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.availableStock)],
  },
  orderAllocated: {
    aliases: ["allocated", "orderallocated", "order_allocated"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.orderAllocated)],
  },
  pendingReceival: {
    aliases: ["pending", "pendingreceival", "pending_receival", "receival"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.pendingReceival)],
  },
  inTransit: {
    aliases: ["transit", "intransit", "in_transit"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.inTransit)],
  },
  toList: {
    aliases: ["tolist", "to_list"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.toList)],
  },
  defectiveProducts: {
    aliases: ["defective", "defectiveproducts", "defective_products"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.defectiveProducts)],
  },
  totalInventory: {
    aliases: ["total", "inventory", "totalinventory", "total_inventory"],
    matchMode: "exact",
    readAll: (row) => [numericFieldValue(row.totalInventory)],
  },
};

const inventoryInformationQueryAliasMap = new Map<string, InventoryInformationQueryField>(
  Object.entries(inventoryInformationQueryFieldDefinitions).flatMap(([field, definition]) =>
    definition.aliases.map((alias) => [alias, field as InventoryInformationQueryField] as const),
  ),
);

export const inventoryInformationQueryPlaceholder =
  'Search product, code, client, warehouse, tags, or use fielded queries like sku:SKU-001 code:MER-001 client:CUS-001';
export const inventoryInformationQueryHelpText =
  "Search covers every visible metric plus hidden metadata like product name, merchant code, barcode, shelves, tags, and client codes.";

export const inventoryInformationAreaDefinitions = [
  { key: "receiving", label: "Receiving" },
  { key: "storage", label: "Storage" },
  { key: "picking", label: "Picking" },
  { key: "staging", label: "Staging" },
  { key: "defect", label: "Defect" },
  { key: "unassigned", label: "Unassigned" },
] as const satisfies ReadonlyArray<{ key: InventoryInformationAreaKey; label: string }>;

const inventoryInformationAreaMatchers: Array<{
  key: InventoryInformationAreaKey;
  keywords: string[];
}> = [
  { key: "defect", keywords: ["DEFECT", "DAMAGE", "DAMAGED", "QC", "QUAR", "RETURN"] },
  { key: "picking", keywords: ["PICK", "PICKFACE", "FORWARD"] },
  { key: "staging", keywords: ["STAGE", "STAGING", "PACK", "DOCK", "SHIP"] },
  { key: "receiving", keywords: ["RCV", "RECV", "RECEIVE", "RECEIVING", "INBOUND"] },
  { key: "storage", keywords: ["STOR", "STORAGE", "BULK", "RESERVE", "PUTAWAY", "RACK"] },
];

function getInventoryInformationAreaLabel(areaKey: InventoryInformationAreaKey) {
  return inventoryInformationAreaDefinitions.find((definition) => definition.key === areaKey)?.label ?? "Unassigned";
}

function resolveInventoryInformationArea(zoneCode: string, locationTypeCode: string) {
  const normalizedZoneCode = normalizeText(zoneCode).toUpperCase();
  const normalizedLocationTypeCode = normalizeText(locationTypeCode).toUpperCase();
  const combined = `${normalizedZoneCode} ${normalizedLocationTypeCode}`.trim();
  const matchedArea =
    inventoryInformationAreaMatchers.find(({ keywords }) => keywords.some((keyword) => combined.includes(keyword)))?.key ??
    (combined ? "storage" : "unassigned");

  return {
    areaKey: matchedArea,
    areaLabel: getInventoryInformationAreaLabel(matchedArea),
    zoneCode: normalizedZoneCode,
    locationTypeCode: normalizedLocationTypeCode,
  };
}

function buildDefaultInventoryInformationLocationMetadata() {
  return {
    areaKey: "unassigned" as const,
    areaLabel: getInventoryInformationAreaLabel("unassigned"),
    zoneCode: "",
    zoneCodes: [] as string[],
    locationTypeCode: "",
    locationTypeCodes: [] as string[],
  };
}

function buildInventoryInformationLocationLookup(locations: LocationRecord[]) {
  const locationsByWarehouseAndCode = new Map<string, LocationRecord>();
  const uniqueLocationsByCode = new Map<string, LocationRecord>();
  const duplicateCodes = new Set<string>();

  locations.forEach((location) => {
    const normalizedCode = normalizeLocationCode(location.location_code);
    const warehouseKey = normalizeUpperText(location.warehouse_name);

    if (normalizedCode) {
      if (uniqueLocationsByCode.has(normalizedCode)) {
        duplicateCodes.add(normalizedCode);
      } else {
        uniqueLocationsByCode.set(normalizedCode, location);
      }
    }

    if (normalizedCode && warehouseKey) {
      locationsByWarehouseAndCode.set(`${warehouseKey}::${normalizedCode}`, location);
    }
  });

  duplicateCodes.forEach((code) => {
    uniqueLocationsByCode.delete(code);
  });

  return {
    locationsByWarehouseAndCode,
    uniqueLocationsByCode,
  };
}

function findInventoryInformationLocationMatch(
  warehouseName: string,
  shelf: string,
  lookup: ReturnType<typeof buildInventoryInformationLocationLookup>,
) {
  const normalizedShelf = normalizeLocationCode(shelf);
  if (!normalizedShelf) {
    return null;
  }

  const warehouseKey = normalizeUpperText(warehouseName);
  if (warehouseKey) {
    const warehouseScopedLocation = lookup.locationsByWarehouseAndCode.get(`${warehouseKey}::${normalizedShelf}`);
    if (warehouseScopedLocation) {
      return warehouseScopedLocation;
    }
  }

  return lookup.uniqueLocationsByCode.get(normalizedShelf) ?? null;
}

function tokenizeInventoryInformationQuery(query: string) {
  const tokens: string[] = [];
  let currentToken = "";
  let isInQuotes = false;

  for (const character of query.trim()) {
    if (character === '"') {
      isInQuotes = !isInQuotes;
      continue;
    }

    if (/\s/u.test(character) && !isInQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }

    currentToken += character;
  }

  if (currentToken) {
    tokens.push(currentToken);
  }

  return tokens;
}

function normalizeExactQueryValue(value: string) {
  return normalizeText(value).toUpperCase();
}

function matchesExactQueryValue(fieldValue: string, queryValue: string) {
  return normalizeExactQueryValue(fieldValue) === normalizeExactQueryValue(queryValue);
}

function matchesContainsQueryValue(fieldValue: string, queryValue: string) {
  return normalizeText(fieldValue).toLowerCase().includes(normalizeText(queryValue).toLowerCase());
}

function buildSearchableInventoryInformationValues(row: InventoryInformationRow) {
  return uniqueSorted([
    row.merchantSku,
    row.productName,
    row.productBarcode,
    row.productCategory,
    row.productBrand,
    row.productDescription,
    ...row.productTags,
    row.merchantCode,
    row.customerCode,
    ...row.clients.flatMap((client) => [client.code, client.name, client.label]),
    row.warehouseName,
    row.shelf,
    ...row.shelves,
    row.zoneCode,
    ...row.zoneCodes,
    row.locationTypeCode,
    ...row.locationTypeCodes,
    row.listingTime,
    row.actualLength,
    row.actualWidth,
    row.actualHeight,
    row.actualWeight,
    row.measurementUnit,
    row.stockStatus,
    ...row.stockStatuses,
    row.areaKey,
    row.areaLabel,
    row.source,
    numericFieldValue(row.inTransit),
    numericFieldValue(row.pendingReceival),
    numericFieldValue(row.toList),
    numericFieldValue(row.orderAllocated),
    numericFieldValue(row.availableStock),
    numericFieldValue(row.defectiveProducts),
    numericFieldValue(row.totalInventory),
  ]);
}

function matchesBareInventoryInformationQueryToken(row: InventoryInformationRow, token: string) {
  return buildSearchableInventoryInformationValues(row).some((fieldValue) => matchesContainsQueryValue(fieldValue, token));
}

export function matchesInventoryInformationQuery(row: InventoryInformationRow, query: string) {
  const tokens = tokenizeInventoryInformationQuery(query);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => {
    const delimiterIndex = token.indexOf(":");
    if (delimiterIndex === -1) {
      return matchesBareInventoryInformationQueryToken(row, token);
    }

    const rawField = token.slice(0, delimiterIndex).toLowerCase();
    const rawValue = token.slice(delimiterIndex + 1);
    if (!rawValue) {
      return false;
    }

    const resolvedField = inventoryInformationQueryAliasMap.get(rawField);
    if (!resolvedField) {
      return false;
    }

    const definition = inventoryInformationQueryFieldDefinitions[resolvedField];
    const fieldValues = definition.readAll(row);
    return fieldValues.some((fieldValue) =>
      definition.matchMode === "exact"
        ? matchesExactQueryValue(fieldValue, rawValue)
        : matchesContainsQueryValue(fieldValue, rawValue),
    );
  });
}

export function encodeInventoryInformationMultiValue(values: string[]) {
  const normalizedValues = uniqueSorted(values);
  return normalizedValues.length > 0 ? JSON.stringify(normalizedValues) : "";
}

export function decodeInventoryInformationMultiValue(value: string) {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? uniqueSorted(parsed.map((item) => normalizeText(item))) : [];
  } catch {
    return uniqueSorted(value.split(","));
  }
}

export function buildInventoryInformationCsvContent(rows: InventoryInformationRow[]) {
  const header = [
    "merchant_sku",
    "product_name",
    "merchant_code",
    "tags",
    "warehouse_name",
    "clients",
    "in_transit",
    "pending_receival",
    "to_list",
    "order_allocated",
    "available_stock",
    "defective_products",
    "total_inventory",
    "barcode",
    "category",
    "brand",
    "shelves",
    "zone_codes",
    "location_type_codes",
    "listing_time",
    "measurement_unit",
    "source",
  ];

  return [
    header.map((value) => escapeCsvValue(value)).join(","),
    ...rows.map((row) =>
      [
        row.merchantSku,
        row.productName,
        row.merchantCode,
        row.productTags.join(" | "),
        row.warehouseName,
        row.clients.map((client) => client.label).join(" | "),
        row.inTransit,
        row.pendingReceival,
        row.toList,
        row.orderAllocated,
        row.availableStock,
        row.defectiveProducts,
        row.totalInventory,
        row.productBarcode,
        row.productCategory,
        row.productBrand,
        row.shelves.join(" | "),
        row.zoneCodes.join(" | "),
        row.locationTypeCodes.join(" | "),
        row.listingTime,
        row.measurementUnit,
        row.source,
      ]
        .map((value) => escapeCsvValue(value))
        .join(","),
    ),
  ].join("\n");
}

export function downloadInventoryInformationRowsCsv(rows: InventoryInformationRow[], filenamePrefix: string) {
  if (rows.length === 0) {
    return;
  }

  downloadCsvFile(buildInventoryInformationCsvContent(rows), `${filenamePrefix}.csv`);
}

function getInventoryInformationClientLabel(row: InventoryInformationRow) {
  return row.clients[0]?.label || row.customerCode;
}

export function inventoryInformationRowSort(left: InventoryInformationRow, right: InventoryInformationRow) {
  const skuComparison = compareInventoryInformationText(left.merchantSku, right.merchantSku);
  if (skuComparison !== 0) {
    return skuComparison;
  }

  const warehouseComparison = compareInventoryInformationText(left.warehouseName, right.warehouseName);
  if (warehouseComparison !== 0) {
    return warehouseComparison;
  }

  const clientComparison = compareInventoryInformationText(getInventoryInformationClientLabel(left), getInventoryInformationClientLabel(right));
  if (clientComparison !== 0) {
    return clientComparison;
  }

  const productNameComparison = compareInventoryInformationText(left.productName || left.merchantSku, right.productName || right.merchantSku);
  if (productNameComparison !== 0) {
    return productNameComparison;
  }

  if (left.source !== right.source) {
    return left.source === "imported" ? -1 : 1;
  }

  return compareInventoryInformationText(left.id, right.id);
}

const inventoryInformationSortReaders: Record<InventoryInformationSortKey, (row: InventoryInformationRow) => number | string> = {
  merchantSku: (row) => row.merchantSku,
  merchantCode: (row) => row.merchantCode,
  productName: (row) => row.productName || row.merchantSku,
  productBarcode: (row) => row.productBarcode,
  warehouseName: (row) => row.warehouseName,
  client: (row) => getInventoryInformationClientLabel(row),
  inTransit: (row) => row.inTransit,
  pendingReceival: (row) => row.pendingReceival,
  toList: (row) => row.toList,
  orderAllocated: (row) => row.orderAllocated,
  availableStock: (row) => row.availableStock,
  defectiveProducts: (row) => row.defectiveProducts,
  totalInventory: (row) => row.totalInventory,
};

function compareInventoryInformationSortValues(left: number | string, right: number | string) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return compareInventoryInformationText(left, right);
}

export function sortInventoryInformationRows(rows: InventoryInformationRow[], sortKey: InventoryInformationSortKey = "merchantSku") {
  const readSortValue = inventoryInformationSortReaders[sortKey];

  return [...rows].sort((left, right) => {
    const primaryComparison = compareInventoryInformationSortValues(readSortValue(left), readSortValue(right));
    if (primaryComparison !== 0) {
      return primaryComparison;
    }

    return inventoryInformationRowSort(left, right);
  });
}

export function sortInventoryInformationRowsByDirection(
  rows: InventoryInformationRow[],
  sortKey: InventoryInformationSortKey = "merchantSku",
  direction: "asc" | "desc" = "asc",
) {
  const readSortValue = inventoryInformationSortReaders[sortKey];
  const directionFactor = direction === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const primaryComparison = compareInventoryInformationSortValues(readSortValue(left), readSortValue(right));
    if (primaryComparison !== 0) {
      return primaryComparison * directionFactor;
    }

    return inventoryInformationRowSort(left, right);
  });
}

export function formatInventoryListingDate(value: string) {
  if (!value) {
    return "--";
  }

  const normalized = value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return toLocalDateString(parsed);
}

export function hasInventorySizeProfile(row: InventoryInformationRow) {
  return Boolean(row.actualLength && row.actualWidth && row.actualHeight && row.actualWeight && row.measurementUnit);
}

export function annotateInventoryInformationRowsWithLocationMetadata(
  rows: InventoryInformationRow[],
  locations: LocationRecord[],
): InventoryInformationRow[] {
  if (locations.length === 0) {
    return rows.map((row) => ({
      ...row,
      ...buildDefaultInventoryInformationLocationMetadata(),
    }));
  }

  const lookup = buildInventoryInformationLocationLookup(locations);

  return rows.map((row) => {
    const shelves = uniqueSorted([row.shelf, ...row.shelves]);
    const matchedLocations = shelves
      .map((shelf) => findInventoryInformationLocationMatch(row.warehouseName, shelf, lookup))
      .filter((location): location is LocationRecord => location !== null);

    if (matchedLocations.length === 0) {
      return {
        ...row,
        ...buildDefaultInventoryInformationLocationMetadata(),
      };
    }

    const zoneCodes = uniqueSorted(matchedLocations.map((location) => location.zone_code));
    const locationTypeCodes = uniqueSorted(matchedLocations.map((location) => location.location_type_code));
    const primaryMetadata = resolveInventoryInformationArea(zoneCodes[0] ?? "", locationTypeCodes[0] ?? "");

    return {
      ...row,
      ...primaryMetadata,
      zoneCode: zoneCodes[0] ?? "",
      zoneCodes,
      locationTypeCode: locationTypeCodes[0] ?? "",
      locationTypeCodes,
    };
  });
}

export function buildInventoryInformationAreaOptions(rows: InventoryInformationRow[]): InventoryInformationAreaOption[] {
  return inventoryInformationAreaDefinitions
    .map((definition) => ({
      count: rows.filter((row) => row.areaKey === definition.key).length,
      key: definition.key,
      label: definition.label,
    }))
    .filter((option) => option.count > 0);
}

export function buildLiveInventoryInformationRows(
  balances: InventoryBalanceRecord[],
  products: ProductRecord[],
): InventoryInformationRow[] {
  const productsBySku = new Map(products.map((product) => [normalizeUpperText(product.sku), product]));
  const grouped = new Map<string, InventoryInformationRow>();

  balances.forEach((balance) => {
    const merchantSku = normalizeUpperText(balance.goods_code);
    const warehouseName = normalizeText(balance.warehouse_name);
    const key = buildWarehouseSkuKey(warehouseName, merchantSku);
    const product = productsBySku.get(merchantSku);
    const listingTime = formatInventoryListingDate(balance.create_time);
    const shelf = normalizeShelf(balance.location_code);
    const onHandQty = toNumber(balance.on_hand_qty);
    const availableStock = toNumber(balance.available_qty);
    const allocatedQty = toNumber(balance.allocated_qty);
    const holdQty = toNumber(balance.hold_qty);
    const defectiveQty = isDefectiveStockStatus(balance.stock_status) ? onHandQty : 0;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        id: `live:${key}`,
        merchantSku,
        productName: normalizeText(product?.name) || merchantSku,
        productBarcode: normalizeText(product?.barcode),
        productCategory: normalizeText(product?.category),
        productBrand: normalizeText(product?.brand),
        productDescription: normalizeText(product?.description),
        productTags: uniqueSorted([product?.category, product?.brand]),
        clients: [],
        shelf,
        shelves: uniqueSorted([shelf]),
        inTransit: 0,
        pendingReceival: 0,
        toList: defectiveQty > 0 ? 0 : holdQty,
        orderAllocated: allocatedQty,
        availableStock,
        defectiveProducts: defectiveQty,
        totalInventory: onHandQty,
        listingTime,
        actualLength: "",
        actualWidth: "",
        actualHeight: "",
        actualWeight: "",
        measurementUnit: normalizeText(product?.unit_of_measure),
        merchantCode: "",
        customerCode: "",
        warehouseName,
        stockStatus: normalizeUpperText(balance.stock_status),
        stockStatuses: uniqueSorted([balance.stock_status]),
        ...buildDefaultInventoryInformationLocationMetadata(),
        source: "live" as const,
      });
      return;
    }

    current.availableStock += availableStock;
    current.orderAllocated += allocatedQty;
    current.toList += defectiveQty > 0 ? 0 : holdQty;
    current.defectiveProducts += defectiveQty;
    current.totalInventory += onHandQty;
    current.shelves = uniqueSorted([...current.shelves, shelf]);
    current.shelf = current.shelves[0] ?? "";
    current.stockStatuses = uniqueSorted([...current.stockStatuses, balance.stock_status]);
    current.stockStatus = current.stockStatuses.length === 1 ? current.stockStatuses[0] : "MIXED";
    if (compareDatesAscending(listingTime, current.listingTime) < 0) {
      current.listingTime = listingTime;
    }
  });

  return Array.from(grouped.values()).sort(inventoryInformationRowSort);
}

function normalizeImportedInventoryInformationRow(
  row: InventoryInformationRow,
  productsBySku: Map<string, ProductRecord>,
  clientNameByCode: Map<string, string>,
  fallbackWarehouseName: string | undefined,
) {
  const merchantSku = normalizeUpperText(row.merchantSku);
  const product = productsBySku.get(merchantSku);
  const clients = mergeClients(
    row.clients ?? [],
    uniqueSorted([row.customerCode]).map((code) => buildInventoryInformationClient(code, clientNameByCode)).filter(
      (client): client is InventoryInformationClient => client !== null,
    ),
  );
  const availableStock = Number.isFinite(row.availableStock) ? row.availableStock : 0;
  const totalInventory = Number.isFinite(row.totalInventory) && row.totalInventory > 0 ? row.totalInventory : availableStock;

  return {
    ...row,
    merchantSku,
    productName: normalizeText(row.productName) || normalizeText(product?.name) || merchantSku,
    productBarcode: normalizeText(row.productBarcode) || normalizeText(product?.barcode),
    productCategory: normalizeText(row.productCategory) || normalizeText(product?.category),
    productBrand: normalizeText(row.productBrand) || normalizeText(product?.brand),
    productDescription: normalizeText(row.productDescription) || normalizeText(product?.description),
    productTags: uniqueSorted([...(row.productTags ?? []), product?.category, product?.brand]),
    merchantCode: normalizeText(row.merchantCode),
    customerCode: normalizeUpperText(row.customerCode),
    clients,
    warehouseName: normalizeText(row.warehouseName) || normalizeText(fallbackWarehouseName),
    shelf: normalizeShelf(row.shelf),
    shelves: uniqueSorted([row.shelf, ...(row.shelves ?? [])]),
    inTransit: Number.isFinite(row.inTransit) ? row.inTransit : 0,
    pendingReceival: Number.isFinite(row.pendingReceival) ? row.pendingReceival : 0,
    toList: Number.isFinite(row.toList) ? row.toList : 0,
    orderAllocated: Number.isFinite(row.orderAllocated) ? row.orderAllocated : 0,
    availableStock,
    defectiveProducts:
      Number.isFinite(row.defectiveProducts) && row.defectiveProducts > 0
        ? row.defectiveProducts
        : isDefectiveStockStatus(row.stockStatus)
          ? totalInventory
          : 0,
    totalInventory,
    listingTime: normalizeText(row.listingTime),
    measurementUnit: normalizeText(row.measurementUnit) || normalizeText(product?.unit_of_measure),
    stockStatus: normalizeUpperText(row.stockStatus),
    stockStatuses: uniqueSorted([row.stockStatus, ...(row.stockStatuses ?? [])]),
    zoneCode: normalizeUpperText(row.zoneCode),
    zoneCodes: uniqueSorted([row.zoneCode, ...(row.zoneCodes ?? [])]),
    locationTypeCode: normalizeUpperText(row.locationTypeCode),
    locationTypeCodes: uniqueSorted([row.locationTypeCode, ...(row.locationTypeCodes ?? [])]),
  };
}

function enrichInventoryInformationRow(
  row: InventoryInformationRow,
  {
    pendingReceivalLookup,
    orderAllocatedLookup,
    inTransitLookup,
    importedMerchantCodeByWarehouseSku,
    importedClientsByWarehouseSku,
    distributionMetadataBySku,
    clientNameByCode,
  }: {
    pendingReceivalLookup: Map<string, InventoryInformationMetricAggregate>;
    orderAllocatedLookup: Map<string, InventoryInformationMetricAggregate>;
    inTransitLookup: Map<string, InventoryInformationMetricAggregate>;
    importedMerchantCodeByWarehouseSku: Map<string, string>;
    importedClientsByWarehouseSku: Map<string, InventoryInformationClient[]>;
    distributionMetadataBySku: Map<string, InventoryInformationDistributionMetadata>;
    clientNameByCode: Map<string, string>;
  },
) {
  const warehouseSkuKey = buildWarehouseSkuKey(row.warehouseName, row.merchantSku);
  const explicitCustomer = normalizeUpperText(row.customerCode);
  const importedMerchantCode = importedMerchantCodeByWarehouseSku.get(warehouseSkuKey) ?? "";
  const distributionMetadata = distributionMetadataBySku.get(normalizeUpperText(row.merchantSku));
  const importedClients = importedClientsByWarehouseSku.get(warehouseSkuKey) ?? [];
  const operationalClients = [
    ...(pendingReceivalLookup.get(warehouseSkuKey)?.clientCodes ?? new Set<string>()),
    ...(orderAllocatedLookup.get(warehouseSkuKey)?.clientCodes ?? new Set<string>()),
  ]
    .map((clientCode) => buildInventoryInformationClient(clientCode, clientNameByCode))
    .filter((client): client is InventoryInformationClient => client !== null);
  const mergedClients = mergeClients(
    row.clients,
    importedClients,
    distributionMetadata?.client ? [distributionMetadata.client] : [],
    operationalClients,
  );
  const preferredClient = row.clients[0] ?? importedClients[0] ?? distributionMetadata?.client ?? operationalClients[0] ?? null;
  const resolvedClient = resolvePrimaryInventoryInformationClient(
    explicitCustomer,
    preferredClient,
    mergedClients,
    clientNameByCode,
  );
  const resolvedCustomerCode = explicitCustomer || resolvedClient?.code || "";

  return {
    ...row,
    merchantCode: row.merchantCode || importedMerchantCode || distributionMetadata?.merchantCode || "",
    customerCode: resolvedCustomerCode,
    clients: resolvedClient ? [resolvedClient] : [],
    pendingReceival: resolveAggregateQuantity(
      pendingReceivalLookup.get(warehouseSkuKey),
      resolvedCustomerCode,
      row.pendingReceival,
    ),
    orderAllocated: resolveAggregateQuantity(
      orderAllocatedLookup.get(warehouseSkuKey),
      resolvedCustomerCode,
      resolvedCustomerCode ? 0 : row.orderAllocated,
    ),
    inTransit: resolveAggregateQuantity(inTransitLookup.get(warehouseSkuKey), "", row.inTransit),
  };
}

export function buildInventoryInformationRows({
  balances,
  products,
  importedRows,
  clientAccounts,
  distributionProducts,
  purchaseOrders,
  salesOrders,
  putawayTasks,
  locations,
  fallbackWarehouseName,
}: {
  balances: InventoryBalanceRecord[];
  products: ProductRecord[];
  importedRows: InventoryInformationRow[];
  clientAccounts: ClientAccountRecord[];
  distributionProducts?: DistributionProductRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  salesOrders: SalesOrderRecord[];
  putawayTasks: PutawayTaskRecord[];
  locations: LocationRecord[];
  fallbackWarehouseName?: string;
}) {
  const productsBySku = new Map(products.map((product) => [normalizeUpperText(product.sku), product]));
  const clientNameByCode = buildClientNameByCode(clientAccounts);
  const distributionMetadataBySku = buildDistributionMetadataBySku(distributionProducts ?? [], products, clientNameByCode);
  const pendingReceivalLookup = buildPendingReceivalLookup(purchaseOrders);
  const orderAllocatedLookup = buildOrderAllocatedLookup(salesOrders);
  const inTransitLookup = buildInTransitLookup(putawayTasks);
  const liveRows = buildLiveInventoryInformationRows(balances, products);
  const liveRowsByWarehouseSku = new Map(liveRows.map((row) => [buildWarehouseSkuKey(row.warehouseName, row.merchantSku), row]));
  const normalizedImportedRows = importedRows.map((row) =>
    normalizeImportedInventoryInformationRow(row, productsBySku, clientNameByCode, fallbackWarehouseName),
  );
  const importedMerchantCodeByWarehouseSku = buildImportedMerchantCodeByWarehouseSku(normalizedImportedRows);
  const importedClientsByWarehouseSku = buildImportedClientsByWarehouseSku(normalizedImportedRows, clientNameByCode);
  const coveredLiveKeys = new Set(
    normalizedImportedRows
      .map((row) => buildWarehouseSkuKey(row.warehouseName, row.merchantSku))
      .filter((key) => normalizeText(key)),
  );

  const enrichedImportedRows = normalizedImportedRows.map((row) => {
    const liveMatch = liveRowsByWarehouseSku.get(buildWarehouseSkuKey(row.warehouseName, row.merchantSku));
    const baseRow = liveMatch
      ? {
          ...row,
          availableStock: liveMatch.availableStock,
          defectiveProducts: liveMatch.defectiveProducts,
          totalInventory: liveMatch.totalInventory,
          toList: liveMatch.toList,
          shelves: row.shelves.length > 0 ? row.shelves : liveMatch.shelves,
          shelf: row.shelf || liveMatch.shelf,
          stockStatuses: row.stockStatuses.length > 0 ? row.stockStatuses : liveMatch.stockStatuses,
          stockStatus: row.stockStatus || liveMatch.stockStatus,
          listingTime: row.listingTime || liveMatch.listingTime,
          measurementUnit: row.measurementUnit || liveMatch.measurementUnit,
        }
      : row;

    return enrichInventoryInformationRow(baseRow, {
      pendingReceivalLookup,
      orderAllocatedLookup,
        inTransitLookup,
        importedMerchantCodeByWarehouseSku,
        importedClientsByWarehouseSku,
        distributionMetadataBySku,
        clientNameByCode,
      });
  });

  const visibleLiveRows = liveRows
    .filter((row) => !coveredLiveKeys.has(buildWarehouseSkuKey(row.warehouseName, row.merchantSku)))
    .map((row) =>
      enrichInventoryInformationRow(row, {
        pendingReceivalLookup,
        orderAllocatedLookup,
        inTransitLookup,
        importedMerchantCodeByWarehouseSku,
        importedClientsByWarehouseSku,
        distributionMetadataBySku,
        clientNameByCode,
      }),
    );

  return annotateInventoryInformationRowsWithLocationMetadata(
    [...enrichedImportedRows, ...visibleLiveRows].sort(inventoryInformationRowSort),
    locations,
  ).sort(inventoryInformationRowSort);
}

export function mapInventoryInformationImportApiRow(row: InventoryInformationImportApiRow, index: number): InventoryInformationRow {
  const merchantCode = normalizeText(row.merchant_code);
  const customerCode = normalizeUpperText(row.customer_code);

  return {
    id: `imported:${row.merchant_sku}:${row.shelf}:${index}`,
    merchantSku: normalizeUpperText(row.merchant_sku),
    productName: normalizeText(row.product_name),
    productBarcode: "",
    productCategory: "",
    productBrand: "",
    productDescription: "",
    productTags: [],
    merchantCode,
    customerCode,
    clients: [],
    shelf: normalizeShelf(row.shelf),
    shelves: uniqueSorted([row.shelf]),
    inTransit: 0,
    pendingReceival: 0,
    toList: 0,
    orderAllocated: 0,
    availableStock: toNumber(row.available_stock),
    defectiveProducts: isDefectiveStockStatus(row.stock_status) ? toNumber(row.available_stock) : 0,
    totalInventory: toNumber(row.available_stock),
    listingTime: normalizeText(row.listing_time),
    actualLength: normalizeText(row.actual_length),
    actualWidth: normalizeText(row.actual_width),
    actualHeight: normalizeText(row.actual_height),
    actualWeight: normalizeText(row.actual_weight),
    measurementUnit: normalizeText(row.measurement_unit),
    warehouseName: normalizeText(row.warehouse_name),
    stockStatus: normalizeUpperText(row.stock_status),
    stockStatuses: uniqueSorted([row.stock_status]),
    ...buildDefaultInventoryInformationLocationMetadata(),
    source: row.source,
  };
}

export function mapInventoryInformationImportResult(result: {
  imported_rows: InventoryInformationImportApiRow[];
  warnings: string[];
  errors: string[];
}): InventoryInformationImportResult {
  return {
    importedRows: result.imported_rows.map(mapInventoryInformationImportApiRow).sort(inventoryInformationRowSort),
    warnings: result.warnings,
    errors: result.errors,
  };
}
