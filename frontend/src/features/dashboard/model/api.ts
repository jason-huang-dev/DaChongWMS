export const dashboardApi = {
  balances: "/api/inventory/balances/",
  advanceShipmentNotices: "/api/inbound/advance-shipment-notices/",
  purchaseOrders: "/api/inbound/purchase-orders/",
  putawayTasks: "/api/inbound/putaway-tasks/",
  salesOrders: "/api/outbound/sales-orders/",
  pickTasks: "/api/outbound/pick-tasks/",
  returnOrders: "/api/returns/return-orders/",
  approvalSummary: "/api/counting/approvals/summary/",
  countingDashboard: "/api/counting/approvals/dashboard/",
  invoices: "/api/reporting/invoices/",
  invoiceSettlements: "/api/reporting/invoice-settlements/",
  invoiceDisputes: "/api/reporting/invoice-disputes/",
} as const;
