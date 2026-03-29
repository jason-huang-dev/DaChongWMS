import { inventoryWorkspaceItems } from "@/features/inventory/view/inventory-navigation";

export type InventoryWorkspaceItem = (typeof inventoryWorkspaceItems)[number];
export type InventorySidebarMode = "compact" | "hidden";

export interface InventoryWorkspaceLayoutPayload {
  quick_access_paths: string[];
  sidebar_mode: InventorySidebarMode;
}

export const inventoryWorkspaceItemByPath = new Map(inventoryWorkspaceItems.map((item) => [item.to, item]));

export function isInventoryWorkspaceItemActive(item: InventoryWorkspaceItem, pathname: string) {
  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function resolveInventoryWorkspaceItem(pathname: string) {
  return inventoryWorkspaceItems.find((item) => isInventoryWorkspaceItemActive(item, pathname));
}

function isPersistedSidebarMode(value: string): value is InventorySidebarMode | "expanded" {
  return value === "expanded" || value === "compact" || value === "hidden";
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function buildInventoryWorkspaceLayoutPayload(layoutPayload: Record<string, unknown> | undefined): InventoryWorkspaceLayoutPayload {
  const quickAccessPaths = toStringArray(layoutPayload?.quick_access_paths).filter((path) => inventoryWorkspaceItemByPath.has(path));
  const persistedSidebarMode =
    typeof layoutPayload?.sidebar_mode === "string" && isPersistedSidebarMode(layoutPayload.sidebar_mode)
      ? layoutPayload.sidebar_mode
      : "compact";
  const sidebarMode = persistedSidebarMode === "hidden" ? "hidden" : "compact";

  return {
    quick_access_paths: quickAccessPaths,
    sidebar_mode: sidebarMode,
  };
}

export function buildNextInventoryQuickAccessPaths(currentPath: string, quickAccessPaths: string[]) {
  return [currentPath, ...quickAccessPaths.filter((path) => path !== currentPath)];
}

export function buildInventoryHotPathItems(pathname: string, quickAccessPaths: string[]) {
  const activeItem = resolveInventoryWorkspaceItem(pathname);
  const quickAccessItems = quickAccessPaths
    .map((path) => inventoryWorkspaceItemByPath.get(path))
    .filter((item): item is InventoryWorkspaceItem => Boolean(item));

  if (!activeItem) {
    return quickAccessItems;
  }

  return [activeItem, ...quickAccessItems.filter((item) => item.to !== activeItem.to)];
}
