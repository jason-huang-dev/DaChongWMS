export const dashboardApi = {
  balances: "/api/inventory/balances/",
  purchaseOrders: "/api/inbound/purchase-orders/",
  salesOrders: "/api/outbound/sales-orders/",
  approvalSummary: "/api/counting/approvals/summary/",
  countingDashboard: "/api/counting/approvals/dashboard/",
  invoices: "/api/reporting/invoices/",
} as const;
