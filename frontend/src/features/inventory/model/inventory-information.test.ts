import { describe, expect, test } from "vitest";

import {
  annotateInventoryInformationRowsWithLocationMetadata,
  buildInventoryInformationAreaOptions,
  buildInventoryInformationCsvContent,
  buildInventoryInformationRows,
  buildLiveInventoryInformationRows,
  matchesInventoryInformationQuery,
  mapInventoryInformationImportResult,
  sortInventoryInformationRows,
  sortInventoryInformationRowsByDirection,
} from "@/features/inventory/model/inventory-information";
import type { InventoryInformationRow } from "@/features/inventory/model/types";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import type { DistributionProductRecord, ProductRecord } from "@/features/products/model/types";
import type { InventoryBalanceRecord, LocationRecord } from "@/shared/types/domain";

function buildInventoryInformationRow(overrides: Partial<InventoryInformationRow> = {}): InventoryInformationRow {
  const row: InventoryInformationRow = {
    id: "live:1",
    merchantSku: "SKU-001",
    productName: "Bluetooth Scanner",
    productBarcode: "",
    productCategory: "",
    productBrand: "",
    productDescription: "",
    productTags: [],
    merchantCode: "",
    customerCode: "",
    clients: [],
    shelf: "A-01-01",
    shelves: ["A-01-01"],
    inTransit: 0,
    pendingReceival: 0,
    toList: 0,
    orderAllocated: 0,
    availableStock: 7,
    defectiveProducts: 0,
    totalInventory: 7,
    listingTime: "2026-03-20",
    actualLength: "",
    actualWidth: "",
    actualHeight: "",
    actualWeight: "",
    measurementUnit: "",
    warehouseName: "Main WH",
    stockStatus: "AVAILABLE",
    stockStatuses: ["AVAILABLE"],
    zoneCode: "",
    zoneCodes: [],
    locationTypeCode: "",
    locationTypeCodes: [],
    areaKey: "unassigned",
    areaLabel: "Unassigned",
    source: "live",
    ...overrides,
  };

  return {
    ...row,
    productTags: overrides.productTags ?? row.productTags,
    shelves: overrides.shelves ?? [row.shelf],
    stockStatuses: overrides.stockStatuses ?? [row.stockStatus],
    zoneCodes: overrides.zoneCodes ?? (row.zoneCode ? [row.zoneCode] : []),
    locationTypeCodes: overrides.locationTypeCodes ?? (row.locationTypeCode ? [row.locationTypeCode] : []),
    totalInventory: overrides.totalInventory ?? row.totalInventory,
  };
}

describe("inventory information helpers", () => {
  test("buildLiveInventoryInformationRows groups live balances by merchant SKU and warehouse", () => {
    const products: ProductRecord[] = [
      {
        id: 10,
        organization_id: 1,
        sku: "SKU-001",
        name: "Bluetooth Scanner",
        barcode: "",
        unit_of_measure: "EA",
        category: "",
        brand: "",
        description: "",
        is_active: true,
      },
    ];
    const balances: InventoryBalanceRecord[] = [
      {
        id: 1,
        warehouse: 1,
        warehouse_name: "Main WH",
        location: 20,
        location_code: "A-01-01",
        goods: 10,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        on_hand_qty: "4.0000",
        allocated_qty: "0.0000",
        hold_qty: "0.0000",
        available_qty: "4.0000",
        unit_cost: "0.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-03-29T10:00:00Z",
        create_time: "2026-03-21 08:00:00",
        update_time: "2026-03-21 08:00:00",
      },
      {
        id: 2,
        warehouse: 1,
        warehouse_name: "Main WH",
        location: 20,
        location_code: "A-01-01",
        goods: 10,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "LOT-2",
        serial_number: "",
        on_hand_qty: "3.0000",
        allocated_qty: "0.0000",
        hold_qty: "0.0000",
        available_qty: "3.0000",
        unit_cost: "0.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-03-29T10:00:00Z",
        create_time: "2026-03-20 08:00:00",
        update_time: "2026-03-20 08:00:00",
      },
    ];

    expect(buildLiveInventoryInformationRows(balances, products)).toEqual([
      buildInventoryInformationRow({
        id: "live:MAIN WH::SKU-001",
        availableStock: 7,
        totalInventory: 7,
        listingTime: "2026-03-20",
        measurementUnit: "EA",
      }),
    ]);
  });

  test("buildLiveInventoryInformationRows keeps matching shelves in different warehouses separate", () => {
    const products: ProductRecord[] = [
      {
        id: 10,
        organization_id: 1,
        sku: "SKU-001",
        name: "Bluetooth Scanner",
        barcode: "",
        unit_of_measure: "EA",
        category: "",
        brand: "",
        description: "",
        is_active: true,
      },
    ];
    const balances: InventoryBalanceRecord[] = [
      {
        id: 1,
        warehouse: 1,
        warehouse_name: "Main WH",
        location: 20,
        location_code: "A-01-01",
        goods: 10,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        on_hand_qty: "4.0000",
        allocated_qty: "0.0000",
        hold_qty: "0.0000",
        available_qty: "4.0000",
        unit_cost: "0.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-03-29T10:00:00Z",
        create_time: "2026-03-21 08:00:00",
        update_time: "2026-03-21 08:00:00",
      },
      {
        id: 2,
        warehouse: 2,
        warehouse_name: "Overflow WH",
        location: 35,
        location_code: "A-01-01",
        goods: 10,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        on_hand_qty: "6.0000",
        allocated_qty: "0.0000",
        hold_qty: "0.0000",
        available_qty: "6.0000",
        unit_cost: "0.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-03-29T10:00:00Z",
        create_time: "2026-03-21 08:00:00",
        update_time: "2026-03-21 08:00:00",
      },
    ];

    expect(buildLiveInventoryInformationRows(balances, products)).toHaveLength(2);
  });

  test("mapInventoryInformationImportResult converts backend payloads into table rows", () => {
    expect(
      mapInventoryInformationImportResult({
        imported_rows: [
          {
            merchant_sku: "SKU-NEW-001",
            product_name: "New Scanner",
            shelf: "B-01-01",
            available_stock: "12",
            listing_time: "2026-03-29",
            actual_length: "12.5",
            actual_width: "8.2",
            actual_height: "4.5",
            actual_weight: "260",
            measurement_unit: "cm/g",
            merchant_code: "MER-001",
            customer_code: "CUS-001",
            warehouse_name: "",
            stock_status: "AVAILABLE",
            source: "imported",
          },
        ],
        warnings: ["Duplicate Merchant SKU + Shelf detected for SKU-NEW-001 at B-01-01. The first row was kept."],
        errors: [],
      }),
    ).toEqual({
      importedRows: [
        buildInventoryInformationRow({
          id: "imported:SKU-NEW-001:B-01-01:0",
          merchantSku: "SKU-NEW-001",
          productName: "New Scanner",
          merchantCode: "MER-001",
          customerCode: "CUS-001",
          shelf: "B-01-01",
          shelves: ["B-01-01"],
          availableStock: 12,
          totalInventory: 12,
          listingTime: "2026-03-29",
          actualLength: "12.5",
          actualWidth: "8.2",
          actualHeight: "4.5",
          actualWeight: "260",
          measurementUnit: "cm/g",
          warehouseName: "",
          source: "imported",
        }),
      ],
      warnings: ["Duplicate Merchant SKU + Shelf detected for SKU-NEW-001 at B-01-01. The first row was kept."],
      errors: [],
    });
  });

  test("matchesInventoryInformationQuery searches visible and hidden metadata", () => {
    const row = buildInventoryInformationRow({
      merchantCode: "MER-001",
      customerCode: "CUS-001",
      clients: [{ code: "CUS-001", name: "Retail Client", label: "Retail Client [CUS-001]" }],
      productBarcode: "BAR-001",
      productBrand: "Acme",
      productCategory: "Scanners",
      productTags: ["Acme", "Scanners"],
      zoneCode: "PICK",
      zoneCodes: ["PICK"],
      locationTypeCode: "PICKFACE",
      locationTypeCodes: ["PICKFACE"],
      areaKey: "picking",
      areaLabel: "Picking",
      inTransit: 2,
      pendingReceival: 5,
      orderAllocated: 1,
    });

    expect(matchesInventoryInformationQuery(row, 'sku:SKU-001 shelf:A-01-01 source:live')).toBe(true);
    expect(matchesInventoryInformationQuery(row, "area:picking zone:PICK type:PICKFACE")).toBe(true);
    expect(matchesInventoryInformationQuery(row, 'product:"Bluetooth Scanner"')).toBe(true);
    expect(matchesInventoryInformationQuery(row, "Bluetooth")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "MER-001")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "code:MER-001")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "Retail Client")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "clientid:CUS-001")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "Retail Client [CUS-001]")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "Scanners")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "BAR-001")).toBe(true);
    expect(matchesInventoryInformationQuery(row, "allocated:1 pending:5 transit:2")).toBe(true);
    expect(matchesInventoryInformationQuery(row, 'sku:SKU-001 shelf:B-01-01')).toBe(false);
    expect(matchesInventoryInformationQuery(row, "unknown:SKU-001")).toBe(false);
  });

  test("sortInventoryInformationRows uses natural ordering for SKU and Unicode text", () => {
    const rows = [
      buildInventoryInformationRow({ id: "row-10", merchantSku: "SKU-10", productName: "商品10" }),
      buildInventoryInformationRow({ id: "row-2", merchantSku: "SKU-2", productName: "商品2" }),
      buildInventoryInformationRow({ id: "row-1", merchantSku: "SKU-1", productName: "商品1" }),
    ];

    expect(sortInventoryInformationRows(rows).map((row) => row.merchantSku)).toEqual(["SKU-1", "SKU-2", "SKU-10"]);
    expect(sortInventoryInformationRows(rows, "productName").map((row) => row.productName)).toEqual(["商品1", "商品2", "商品10"]);
    expect(sortInventoryInformationRowsByDirection(rows, "merchantSku", "desc").map((row) => row.merchantSku)).toEqual([
      "SKU-10",
      "SKU-2",
      "SKU-1",
    ]);
  });

  test("buildInventoryInformationRows resolves a single client per product row", () => {
    const products: ProductRecord[] = [
      {
        id: 10,
        organization_id: 1,
        sku: "SKU-001",
        name: "Bluetooth Scanner",
        barcode: "BAR-001",
        unit_of_measure: "EA",
        category: "Scanners",
        brand: "Acme",
        description: "Warehouse scanner",
        is_active: true,
      },
    ];
    const clientAccounts: ClientAccountRecord[] = [
      {
        id: 21,
        organization_id: 1,
        name: "Retail Client",
        code: "CUS-001",
        contact_name: "Alex",
        contact_email: "alex@example.com",
        contact_phone: "555-0100",
        billing_email: "billing@example.com",
        shipping_method: "Ground",
        allow_dropshipping_orders: true,
        allow_inbound_goods: true,
        notes: "",
        is_active: true,
      },
      {
        id: 22,
        organization_id: 1,
        name: "Nova Retail Group",
        code: "NOVA-RETAIL",
        contact_name: "Jamie",
        contact_email: "jamie@example.com",
        contact_phone: "555-0101",
        billing_email: "nova@example.com",
        shipping_method: "Express",
        allow_dropshipping_orders: true,
        allow_inbound_goods: true,
        notes: "",
        is_active: true,
      },
    ];
    const distributionProducts: DistributionProductRecord[] = [
      {
        id: 31,
        product_id: 10,
        customer_account_id: 21,
        customer_account_name: "Retail Client",
        customer_account_code: "CUS-001",
        external_sku: "MER-001",
        external_name: "Retail Scanner",
        channel_name: "Shopify",
        allow_dropshipping_orders: true,
        allow_inbound_goods: true,
        is_active: true,
      },
      {
        id: 32,
        product_id: 10,
        customer_account_id: 22,
        customer_account_name: "Nova Retail Group",
        customer_account_code: "NOVA-RETAIL",
        external_sku: "MER-002",
        external_name: "Nova Scanner",
        channel_name: "TikTok Shop",
        allow_dropshipping_orders: true,
        allow_inbound_goods: true,
        is_active: true,
      },
    ];
    const balances: InventoryBalanceRecord[] = [
      {
        id: 1,
        warehouse: 1,
        warehouse_name: "Main WH",
        location: 20,
        location_code: "A-01-01",
        goods: 10,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        on_hand_qty: "7.0000",
        allocated_qty: "1.0000",
        hold_qty: "0.0000",
        available_qty: "6.0000",
        unit_cost: "0.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-03-29T10:00:00Z",
        create_time: "2026-03-21 08:00:00",
        update_time: "2026-03-21 08:00:00",
      },
    ];

    const rows = buildInventoryInformationRows({
      balances,
      products,
      importedRows: [],
      clientAccounts,
      distributionProducts,
      purchaseOrders: [],
      salesOrders: [],
      putawayTasks: [],
      locations: [],
      fallbackWarehouseName: "Main WH",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      merchantCode: "MER-001",
      customerCode: "CUS-001",
      clients: [{ code: "CUS-001", name: "Retail Client", label: "Retail Client [CUS-001]" }],
    });
    expect(rows[0].clients).toHaveLength(1);
    expect(matchesInventoryInformationQuery(rows[0], "merchant:MER-001 client:CUS-001")).toBe(true);
    expect(matchesInventoryInformationQuery(rows[0], "code:MER-001 clientid:CUS-001")).toBe(true);
    expect(matchesInventoryInformationQuery(rows[0], "Nova Retail Group")).toBe(false);
  });

  test("buildInventoryInformationCsvContent guards against formula injection", () => {
    const csv = buildInventoryInformationCsvContent([
      buildInventoryInformationRow({
        id: "imported:1",
        merchantSku: "=cmd|' /C calc'!A0",
        productName: "Risky",
        zoneCode: "DEF",
        zoneCodes: ["DEF"],
        locationTypeCode: "DEFECT",
        locationTypeCodes: ["DEFECT"],
        areaKey: "defect",
        areaLabel: "Defect",
        source: "imported",
        shelves: ["A-01-01"],
      }),
    ]);

    expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
  });

  test("annotateInventoryInformationRowsWithLocationMetadata maps shelves to area metadata", () => {
    const rows = [
      buildInventoryInformationRow({
        shelf: "PICK-01",
        shelves: ["PICK-01"],
      }),
    ];
    const locations: LocationRecord[] = [
      {
        id: 15,
        warehouse: 1,
        warehouse_name: "Main WH",
        zone: 3,
        zone_code: "PICK",
        location_type: 2,
        location_type_code: "PICKFACE",
        location_code: "PICK-01",
        location_name: "Pick Face 01",
        aisle: "A",
        bay: "01",
        level: "01",
        slot: "01",
        barcode: "PICK-01",
        capacity_qty: "100",
        max_weight: "0",
        max_volume: "0",
        pick_sequence: 1,
        is_pick_face: true,
        is_locked: false,
        status: "ACTIVE",
        creator: "tester",
        openid: "tenant-openid",
        create_time: "2026-03-20 08:00:00",
        update_time: "2026-03-20 08:00:00",
      },
    ];

    const annotatedRows = annotateInventoryInformationRowsWithLocationMetadata(rows, locations);

    expect(annotatedRows[0]).toMatchObject({
      zoneCode: "PICK",
      zoneCodes: ["PICK"],
      locationTypeCode: "PICKFACE",
      locationTypeCodes: ["PICKFACE"],
      areaKey: "picking",
      areaLabel: "Picking",
    });
    expect(buildInventoryInformationAreaOptions(annotatedRows)).toEqual([{ key: "picking", label: "Picking", count: 1 }]);
  });
});
