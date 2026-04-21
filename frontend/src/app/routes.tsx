import { Suspense, lazy, type ComponentType, type ReactElement } from "react";

import type { RouteObject } from "react-router-dom";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";

import {
  automationAccessPermissionCodes,
  b2bPermissionGroups,
  clientsAccessPermissionCodes,
  countingAccessPermissionCodes,
  feesAccessPermissionCodes,
  inboundAccessPermissionCodes,
  integrationsAccessPermissionCodes,
  inventoryAccessPermissionCodes,
  logisticsAccessPermissionCodes,
  outboundAccessPermissionCodes,
  productsAccessPermissionCodes,
  reportingAccessPermissionCodes,
  returnsAccessPermissionCodes,
  statisticsPermissionGroups,
  transfersAccessPermissionCodes,
  workOrdersAccessPermissionCodes,
} from "@/app/access";
import { AppShell } from "@/app/layout/app-shell";
import { RequireAuth, RequirePermissions } from "@/features/auth/view/components/RequireAuth";
import { RouteErrorBoundary } from "@/shared/components/route-error-boundary";
import { RouteFallback } from "@/shared/components/route-fallback";

function lazyNamedPage<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

function withSuspense(element: ReactElement) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function withDefaultRouteErrorElement(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => ({
    ...route,
    children: route.children ? withDefaultRouteErrorElement(route.children) : undefined,
    errorElement: route.errorElement ?? <RouteErrorBoundary />,
  }));
}

const LoginPage = lazyNamedPage(() => import("@/features/auth/view/LoginPage"), "LoginPage");
const SignupPage = lazyNamedPage(() => import("@/features/auth/view/SignupPage"), "SignupPage");
const SocialAuthCallbackPage = lazyNamedPage(
  () => import("@/features/auth/view/SocialAuthCallbackPage"),
  "SocialAuthCallbackPage",
);
const MfaChallengePage = lazyNamedPage(() => import("@/features/mfa/view/MfaChallengePage"), "MfaChallengePage");
const MfaEnrollmentPage = lazyNamedPage(() => import("@/features/mfa/view/MfaEnrollmentPage"), "MfaEnrollmentPage");
const NotAuthorizedPage = lazyNamedPage(() => import("@/features/auth/view/NotAuthorizedPage"), "NotAuthorizedPage");
const SecurityPage = lazyNamedPage(() => import("@/features/security/view/SecurityPage"), "SecurityPage");
const DashboardPage = lazyNamedPage(() => import("@/features/dashboard/view/DashboardPage"), "DashboardPage");
const InventoryWorkspaceLayout = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryWorkspaceLayout"),
  "InventoryWorkspaceLayout",
);
const InventoryBalancesPage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryBalancesPage"),
  "InventoryBalancesPage",
);
const InventoryAgingPage = lazyNamedPage(() => import("@/features/inventory/view/InventoryAgingPage"), "InventoryAgingPage");
const InventoryMovementsPage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryMovementsPage"),
  "InventoryMovementsPage",
);
const InventoryInternalMovePage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryInternalMovePage"),
  "InventoryInternalMovePage",
);
const InventoryAdjustmentsPage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryAdjustmentsPage"),
  "InventoryAdjustmentsPage",
);
const InventoryCrossWarehousePage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryCrossWarehousePage"),
  "InventoryCrossWarehousePage",
);
const InboundWorkspaceLayout = lazyNamedPage(
  () => import("@/features/inbound/view/InboundWorkspaceLayout"),
  "InboundWorkspaceLayout",
);
const InboundStandardStockInPage = lazyNamedPage(
  () => import("@/features/inbound/view/InboundStandardStockInPage"),
  "InboundStandardStockInPage",
);
const InboundImportsPage = lazyNamedPage(
  () => import("@/features/inbound/view/InboundImportsPage"),
  "InboundImportsPage",
);
const InboundReturnsPage = lazyNamedPage(
  () => import("@/features/inbound/view/InboundReturnsPage"),
  "InboundReturnsPage",
);
const InboundRecordsPage = lazyNamedPage(
  () => import("@/features/inbound/view/InboundRecordsPage"),
  "InboundRecordsPage",
);
const PurchaseOrderDetailPage = lazyNamedPage(
  () => import("@/features/inbound/view/PurchaseOrderDetailPage"),
  "PurchaseOrderDetailPage",
);
const OutboundWorkspaceLayout = lazyNamedPage(
  () => import("@/features/outbound/view/OutboundWorkspaceLayout"),
  "OutboundWorkspaceLayout",
);
const StockOutListPage = lazyNamedPage(
  () => import("@/features/outbound/view/StockOutListPage"),
  "StockOutListPage",
);
const OutboundPage = lazyNamedPage(() => import("@/features/outbound/view/OutboundPage"), "OutboundPage");
const SalesOrderDetailPage = lazyNamedPage(
  () => import("@/features/outbound/view/SalesOrderDetailPage"),
  "SalesOrderDetailPage",
);
const TransfersPage = lazyNamedPage(() => import("@/features/transfers/view/TransfersPage"), "TransfersPage");
const TransferOrderDetailPage = lazyNamedPage(
  () => import("@/features/transfers/view/TransferOrderDetailPage"),
  "TransferOrderDetailPage",
);
const ReturnsPage = lazyNamedPage(() => import("@/features/returns/view/ReturnsPage"), "ReturnsPage");
const ClientsPendingApprovalPage = lazyNamedPage(
  () => import("@/features/clients/view/ClientsPage"),
  "ClientsPendingApprovalPage",
);
const ClientsWorkspaceLayout = lazyNamedPage(
  () => import("@/features/clients/view/ClientsWorkspaceLayout"),
  "ClientsWorkspaceLayout",
);
const ClientsApprovedPage = lazyNamedPage(
  () => import("@/features/clients/view/ClientsPage"),
  "ClientsApprovedPage",
);
const ClientsReviewNotApprovedPage = lazyNamedPage(
  () => import("@/features/clients/view/ClientsPage"),
  "ClientsReviewNotApprovedPage",
);
const ClientsDeactivatedPage = lazyNamedPage(
  () => import("@/features/clients/view/ClientsPage"),
  "ClientsDeactivatedPage",
);
const ProductsPage = lazyNamedPage(() => import("@/features/products/view/ProductsPage"), "ProductsPage");
const LogisticsPage = lazyNamedPage(() => import("@/features/logistics/view/LogisticsPage"), "LogisticsPage");
const WorkOrdersPage = lazyNamedPage(() => import("@/features/work-orders/view/WorkOrdersPage"), "WorkOrdersPage");
const B2BPage = lazyNamedPage(() => import("@/features/b2b/view/B2BPage"), "B2BPage");
const ReturnOrderDetailPage = lazyNamedPage(
  () => import("@/features/returns/view/ReturnOrderDetailPage"),
  "ReturnOrderDetailPage",
);
const CountingPage = lazyNamedPage(() => import("@/features/counting/view/CountingPage"), "CountingPage");
const StatisticsPage = lazyNamedPage(() => import("@/features/statistics/view/StatisticsPage"), "StatisticsPage");
const CountApprovalDetailPage = lazyNamedPage(
  () => import("@/features/counting/view/CountApprovalDetailPage"),
  "CountApprovalDetailPage",
);
const AutomationPage = lazyNamedPage(() => import("@/features/automation/view/AutomationPage"), "AutomationPage");
const ScheduledTaskDetailPage = lazyNamedPage(
  () => import("@/features/automation/view/ScheduledTaskDetailPage"),
  "ScheduledTaskDetailPage",
);
const BackgroundTaskDetailPage = lazyNamedPage(
  () => import("@/features/automation/view/BackgroundTaskDetailPage"),
  "BackgroundTaskDetailPage",
);
const IntegrationsPage = lazyNamedPage(() => import("@/features/integrations/view/IntegrationsPage"), "IntegrationsPage");
const IntegrationJobDetailPage = lazyNamedPage(
  () => import("@/features/integrations/view/IntegrationJobDetailPage"),
  "IntegrationJobDetailPage",
);
const WebhookEventDetailPage = lazyNamedPage(
  () => import("@/features/integrations/view/WebhookEventDetailPage"),
  "WebhookEventDetailPage",
);
const CarrierBookingDetailPage = lazyNamedPage(
  () => import("@/features/integrations/view/CarrierBookingDetailPage"),
  "CarrierBookingDetailPage",
);
const FeesPage = lazyNamedPage(() => import("@/features/fees/view/FeesPage"), "FeesPage");
const InvoiceDetailPage = lazyNamedPage(
  () => import("@/features/reporting/view/InvoiceDetailPage"),
  "InvoiceDetailPage",
);

const baseRoutes: RouteObject[] = [
  {
    path: "/login",
    element: withSuspense(<LoginPage />),
    handle: { crumb: "Login" },
  },
  {
    path: "/signup",
    element: withSuspense(<SignupPage />),
    handle: { crumb: "Sign up" },
  },
  {
    path: "/auth/social/callback",
    element: withSuspense(<SocialAuthCallbackPage />),
    handle: { crumb: "Social sign-in" },
  },
  {
    path: "/mfa/challenge",
    element: withSuspense(<MfaChallengePage />),
    handle: { crumb: "MFA challenge" },
  },
  {
    path: "/not-authorized",
    element: withSuspense(<NotAuthorizedPage />),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate replace to="/dashboard" />,
          },
          {
            path: "/dashboard",
            element: withSuspense(<DashboardPage />),
            handle: { crumb: "Dashboard" },
          },
          {
            path: "/mfa/enroll",
            element: withSuspense(<MfaEnrollmentPage />),
            handle: { crumb: "MFA" },
          },
          {
            path: "/security",
            element: withSuspense(<SecurityPage />),
            handle: { crumb: "Security" },
          },
          {
            element: <RequirePermissions permissionCodes={inventoryAccessPermissionCodes} />,
            children: [
              {
                path: "/inventory",
                element: withSuspense(<InventoryWorkspaceLayout />),
                handle: { crumb: "Inventory" },
                children: [
                  {
                    index: true,
                    element: withSuspense(<InventoryBalancesPage />),
                    handle: { crumb: "Inventory information" },
                  },
                  {
                    path: "movements",
                    element: withSuspense(<InventoryMovementsPage />),
                    handle: { crumb: "Inventory Movements" },
                  },
                  {
                    path: "internal-move",
                    element: withSuspense(<InventoryInternalMovePage />),
                    handle: { crumb: "Internal Move" },
                  },
                  {
                    path: "aging",
                    element: withSuspense(<InventoryAgingPage />),
                    handle: { crumb: "Stock age report" },
                  },
                  {
                    path: "adjustments",
                    element: withSuspense(<InventoryAdjustmentsPage />),
                    handle: { crumb: "Inventory adjustment" },
                  },
                  {
                    path: "cross-warehouse",
                    element: withSuspense(<InventoryCrossWarehousePage />),
                    handle: { crumb: "Inter-warehouse transfer" },
                  },
                ],
              },
              {
                path: "/inventory/balances",
                element: <Navigate replace to="/inventory" />,
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={inboundAccessPermissionCodes} />,
            children: [
              {
                path: "/inbound",
                element: withSuspense(<InboundWorkspaceLayout />),
                handle: { crumb: "Inbound" },
                children: [
                  {
                    index: true,
                    element: <Navigate replace to="/inbound/standard-stock-in" />,
                  },
                  {
                    path: "standard-stock-in",
                    element: withSuspense(<InboundStandardStockInPage />),
                    handle: { crumb: "Standard stock-in" },
                  },
                  {
                    path: "imports",
                    element: withSuspense(<InboundImportsPage />),
                    handle: { crumb: "Imports" },
                  },
                  {
                    path: "returns",
                    element: withSuspense(<InboundReturnsPage />),
                    handle: { crumb: "Returns to stock in" },
                  },
                  {
                    path: "records",
                    element: withSuspense(<InboundRecordsPage />),
                    handle: { crumb: "Records" },
                  },
                ],
              },
              {
                path: "/inbound/purchase-orders/:purchaseOrderId",
                element: withSuspense(<PurchaseOrderDetailPage />),
                handle: { crumb: "PO detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={outboundAccessPermissionCodes} />,
            children: [
              {
                path: "/outbound",
                element: withSuspense(<OutboundWorkspaceLayout />),
                handle: { crumb: "Outbound" },
                children: [
                  {
                    index: true,
                    element: withSuspense(<StockOutListPage />),
                    handle: { crumb: "Stock-out list" },
                  },
                  {
                    path: "workbench",
                    element: withSuspense(<OutboundPage />),
                    handle: { crumb: "Operations workbench" },
                  },
                ],
              },
              {
                path: "/outbound/sales-orders/:salesOrderId",
                element: withSuspense(<SalesOrderDetailPage />),
                handle: { crumb: "SO detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={productsAccessPermissionCodes} />,
            children: [
              {
                path: "/products",
                element: withSuspense(<ProductsPage />),
                handle: { crumb: "Products" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={logisticsAccessPermissionCodes} />,
            children: [
              {
                path: "/logistics",
                element: withSuspense(<LogisticsPage />),
                handle: { crumb: "Logistics" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionGroups={b2bPermissionGroups} />,
            children: [
              {
                path: "/b2b",
                element: withSuspense(<B2BPage />),
                handle: { crumb: "B2B" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={workOrdersAccessPermissionCodes} />,
            children: [
              {
                path: "/work-orders",
                element: withSuspense(<WorkOrdersPage />),
                handle: { crumb: "Work orders" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={clientsAccessPermissionCodes} />,
            children: [
              {
                path: "/clients",
                element: withSuspense(<ClientsWorkspaceLayout />),
                handle: { crumb: "Clients" },
                children: [
                  {
                    index: true,
                    element: <Navigate replace to="approved" />,
                  },
                  {
                    path: "pending-approval",
                    element: withSuspense(<ClientsPendingApprovalPage />),
                    handle: { crumb: "Pending approval clients" },
                  },
                  {
                    path: "approved",
                    element: withSuspense(<ClientsApprovedPage />),
                    handle: { crumb: "Approved clients" },
                  },
                  {
                    path: "review-not-approved",
                    element: withSuspense(<ClientsReviewNotApprovedPage />),
                    handle: { crumb: "Review not approved clients" },
                  },
                  {
                    path: "deactivated",
                    element: withSuspense(<ClientsDeactivatedPage />),
                    handle: { crumb: "Deactivated clients" },
                  },
                ],
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={transfersAccessPermissionCodes} />,
            children: [
              {
                path: "/transfers",
                element: withSuspense(<TransfersPage />),
                handle: { crumb: "Transfers" },
              },
              {
                path: "/transfers/transfer-orders/:transferOrderId",
                element: withSuspense(<TransferOrderDetailPage />),
                handle: { crumb: "Transfer detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={returnsAccessPermissionCodes} />,
            children: [
              {
                path: "/returns",
                element: withSuspense(<ReturnsPage />),
                handle: { crumb: "Returns" },
              },
              {
                path: "/returns/return-orders/:returnOrderId",
                element: withSuspense(<ReturnOrderDetailPage />),
                handle: { crumb: "Return detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={countingAccessPermissionCodes} />,
            children: [
              {
                path: "/counting",
                element: withSuspense(<CountingPage />),
                handle: { crumb: "Counting" },
              },
              {
                path: "/counting/approvals/:approvalId",
                element: withSuspense(<CountApprovalDetailPage />),
                handle: { crumb: "Approval detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionGroups={statisticsPermissionGroups} />,
            children: [
              {
                path: "/statistics",
                element: withSuspense(<StatisticsPage />),
                handle: { crumb: "Statistics" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={automationAccessPermissionCodes} />,
            children: [
              {
                path: "/automation",
                element: withSuspense(<AutomationPage />),
                handle: { crumb: "Automation" },
              },
              {
                path: "/automation/scheduled-tasks/:scheduledTaskId",
                element: withSuspense(<ScheduledTaskDetailPage />),
                handle: { crumb: "Schedule detail" },
              },
              {
                path: "/automation/background-tasks/:backgroundTaskId",
                element: withSuspense(<BackgroundTaskDetailPage />),
                handle: { crumb: "Task detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={integrationsAccessPermissionCodes} />,
            children: [
              {
                path: "/integrations",
                element: withSuspense(<IntegrationsPage />),
                handle: { crumb: "Integrations" },
              },
              {
                path: "/integrations/jobs/:jobId",
                element: withSuspense(<IntegrationJobDetailPage />),
                handle: { crumb: "Job detail" },
              },
              {
                path: "/integrations/webhooks/:webhookId",
                element: withSuspense(<WebhookEventDetailPage />),
                handle: { crumb: "Webhook detail" },
              },
              {
                path: "/integrations/carrier-bookings/:carrierBookingId",
                element: withSuspense(<CarrierBookingDetailPage />),
                handle: { crumb: "Carrier booking detail" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={feesAccessPermissionCodes} />,
            children: [
              {
                path: "/finance",
                element: withSuspense(<FeesPage />),
                handle: { crumb: "Finance" },
              },
            ],
          },
          {
            element: <RequirePermissions permissionCodes={reportingAccessPermissionCodes} />,
            children: [
              {
                path: "/finance/invoices/:invoiceId",
                element: withSuspense(<InvoiceDetailPage />),
                handle: { crumb: "Invoice detail" },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/dashboard" />,
  },
];

export const appRoutes: RouteObject[] = withDefaultRouteErrorElement(baseRoutes);

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}

export const router = createAppRouter();
