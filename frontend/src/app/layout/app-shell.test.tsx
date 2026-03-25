import { screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";

import { AppShell } from "@/app/layout/app-shell";
import { renderWithProviders } from "@/test/render";

const useAuthMock = vi.fn();
const useTenantScopeMock = vi.fn();
const useWorkspaceTabsMock = vi.fn();

vi.mock("@/features/auth/controller/useAuthController", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => useTenantScopeMock(),
}));

vi.mock("@/app/workspace-preferences", () => ({
  useWorkspaceTabs: () => useWorkspaceTabsMock(),
}));

test("renders accessible module tabs with the compact shell header", () => {
  useAuthMock.mockReturnValue({
    logout: vi.fn(),
    session: {
      membershipId: 1,
      openid: "tenant-openid",
      operatorId: 11,
      operatorName: "Route Tester",
      operatorRole: "Manager",
      token: "token-1",
      username: "manager",
    },
  });
  useTenantScopeMock.mockReturnValue({
    activeMembershipId: 1,
    activeWarehouse: {
      create_time: "2026-03-21T00:00:00Z",
      creator: "Route Tester",
      id: 1,
      update_time: "2026-03-21T00:00:00Z",
      warehouse_address: "1 Dock Way",
      warehouse_city: "New York",
      warehouse_contact: "Dock Lead",
      warehouse_manager: "Ops Manager",
      warehouse_name: "Main WH",
    },
    activeWarehouseId: 1,
    company: {
      description: "Primary workspace",
      id: 1,
      label: "DaChong WMS",
      openid: "tenant-openid",
    },
    memberships: [
      {
        can_manage_users: true,
        check_code: 8888,
        company_code: "DCWMS",
        company_description: "Primary workspace",
        company_id: 1,
        company_name: "DaChong WMS",
        company_openid: "tenant-openid",
        create_time: "2026-03-21T00:00:00Z",
        default_warehouse: 1,
        default_warehouse_name: "Main WH",
        email: "manager@example.com",
        id: 1,
        is_active: true,
        is_company_admin: true,
        is_current: true,
        is_lock: false,
        last_selected_at: "2026-03-21T00:00:00Z",
        profile_token: "token-1",
        staff_id: 11,
        staff_name: "Route Tester",
        staff_type: "Manager",
        update_time: "2026-03-21T00:00:00Z",
        username: "manager",
      },
    ],
    setActiveWarehouseId: vi.fn(),
    switchMembership: vi.fn(),
    warehouses: [
      {
        create_time: "2026-03-21T00:00:00Z",
        creator: "Route Tester",
        id: 1,
        update_time: "2026-03-21T00:00:00Z",
        warehouse_address: "1 Dock Way",
        warehouse_city: "New York",
        warehouse_contact: "Dock Lead",
        warehouse_manager: "Ops Manager",
        warehouse_name: "Main WH",
      },
    ],
    warehousesQuery: {
      data: undefined,
      error: null,
      fetchStatus: "idle",
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      refetch: vi.fn(),
      status: "success",
    },
  });
  useWorkspaceTabsMock.mockReturnValue({
    activateTab: vi.fn(),
    closeTab: vi.fn(),
    isClosingTab: false,
    tabs: [
      {
        context_payload: {},
        create_time: "2026-03-21T00:00:00Z",
        icon_key: "",
        id: 1,
        is_active: true,
        is_pinned: false,
        last_opened_at: "2026-03-21T00:00:00Z",
        membership_id: 1,
        position: 0,
        route_key: "dashboard",
        route_path: "/dashboard",
        state_payload: {},
        title: "Dashboard",
        update_time: "2026-03-21T00:00:00Z",
      },
    ],
  });

  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          {
            element: <h1>Dashboard content</h1>,
            handle: { crumb: "Dashboard" },
            path: "/dashboard",
          },
        ],
      },
    ],
    { initialEntries: ["/dashboard"] },
  );

  renderWithProviders(<RouterProvider router={router} />);

  const primaryNavigation = screen.getByRole("tablist", { name: "Primary navigation" });
  expect(within(primaryNavigation).getByRole("tab", { name: "Dashboard" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Inventory" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Clients" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Logistics" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Finance" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Security" })).toBeInTheDocument();

  const workspaceTabs = screen.getByRole("tablist", { name: "Open workspaces" });
  expect(within(workspaceTabs).getByRole("tab", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByAltText("DaChong brand logo")).toBeInTheDocument();
  expect(screen.getByTestId("top-info-bar")).toHaveStyle({
    height: "6px",
    maxHeight: "6px",
  });
  expect(screen.getByTestId("navbar-preferences-pill")).toHaveStyle({
    height: "32px",
    minHeight: "32px",
  });
  expect(screen.getByTestId("navbar-profile-pill")).toHaveStyle({
    height: "32px",
    minHeight: "32px",
  });
  expect(screen.getByRole("heading", { name: "Dashboard content" })).toBeInTheDocument();
});
