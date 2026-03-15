import { Suspense, lazy, type ComponentType, type ReactElement } from "react";

import type { RouteObject } from "react-router-dom";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/app/layout/app-shell";
import { RequireAuth, RequireRoles } from "@/features/auth/view/components/RequireAuth";
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

const LoginPage = lazyNamedPage(() => import("@/features/auth/view/LoginPage"), "LoginPage");
const SignupPage = lazyNamedPage(() => import("@/features/auth/view/SignupPage"), "SignupPage");
const MfaChallengePage = lazyNamedPage(() => import("@/features/mfa/view/MfaChallengePage"), "MfaChallengePage");
const MfaEnrollmentPage = lazyNamedPage(() => import("@/features/mfa/view/MfaEnrollmentPage"), "MfaEnrollmentPage");
const NotAuthorizedPage = lazyNamedPage(() => import("@/features/auth/view/NotAuthorizedPage"), "NotAuthorizedPage");
const DashboardPage = lazyNamedPage(() => import("@/features/dashboard/view/DashboardPage"), "DashboardPage");
const InventoryBalancesPage = lazyNamedPage(
  () => import("@/features/inventory/view/InventoryBalancesPage"),
  "InventoryBalancesPage",
);
const InboundPage = lazyNamedPage(() => import("@/features/inbound/view/InboundPage"), "InboundPage");
const PurchaseOrderDetailPage = lazyNamedPage(
  () => import("@/features/inbound/view/PurchaseOrderDetailPage"),
  "PurchaseOrderDetailPage",
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
const ReturnOrderDetailPage = lazyNamedPage(
  () => import("@/features/returns/view/ReturnOrderDetailPage"),
  "ReturnOrderDetailPage",
);
const CountingPage = lazyNamedPage(() => import("@/features/counting/view/CountingPage"), "CountingPage");
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
const FinancePage = lazyNamedPage(() => import("@/features/reporting/view/FinancePage"), "FinancePage");
const InvoiceDetailPage = lazyNamedPage(
  () => import("@/features/reporting/view/InvoiceDetailPage"),
  "InvoiceDetailPage",
);

export const appRoutes: RouteObject[] = [
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
            handle: { crumb: "Security" },
          },
          {
            element: <RequireRoles roles={["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]} />,
            children: [
              {
                path: "/inventory/balances",
                element: withSuspense(<InventoryBalancesPage />),
                handle: { crumb: "Inventory" },
              },
            ],
          },
          {
            element: <RequireRoles roles={["Manager", "Supervisor", "Inbound", "StockControl"]} />,
            children: [
              {
                path: "/inbound",
                element: withSuspense(<InboundPage />),
                handle: { crumb: "Inbound" },
              },
              {
                path: "/inbound/purchase-orders/:purchaseOrderId",
                element: withSuspense(<PurchaseOrderDetailPage />),
                handle: { crumb: "PO detail" },
              },
            ],
          },
          {
            element: <RequireRoles roles={["Manager", "Supervisor", "Outbound", "StockControl"]} />,
            children: [
              {
                path: "/outbound",
                element: withSuspense(<OutboundPage />),
                handle: { crumb: "Outbound" },
              },
              {
                path: "/outbound/sales-orders/:salesOrderId",
                element: withSuspense(<SalesOrderDetailPage />),
                handle: { crumb: "SO detail" },
              },
            ],
          },
          {
            element: <RequireRoles roles={["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]} />,
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
            element: <RequireRoles roles={["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]} />,
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
            element: <RequireRoles roles={["Manager", "Supervisor", "StockControl"]} />,
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
            element: <RequireRoles roles={["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]} />,
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
            element: <RequireRoles roles={["Finance", "Manager", "Supervisor"]} />,
            children: [
              {
                path: "/finance",
                element: withSuspense(<FinancePage />),
                handle: { crumb: "Finance" },
              },
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

export function createAppRouter() {
  return createBrowserRouter(appRoutes);
}

export const router = createAppRouter();
