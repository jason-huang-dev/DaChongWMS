import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import type { CompanyContextRecord, WarehouseRecord } from "@/shared/types/domain";

interface TenantScopeContextValue {
  company: CompanyContextRecord | null;
  warehouses: WarehouseRecord[];
  warehousesQuery: UseQueryResult<PaginatedResponse<WarehouseRecord>, Error>;
  activeWarehouseId: number | null;
  activeWarehouse: WarehouseRecord | null;
  setActiveWarehouseId: (warehouseId: number | null) => void;
}

const TenantScopeContext = createContext<TenantScopeContextValue | undefined>(undefined);

function getScopeStorageKey(openid: string) {
  return `dachongwms.scope.${openid}`;
}

function loadStoredWarehouseId(openid: string) {
  try {
    const rawValue = window.localStorage.getItem(getScopeStorageKey(openid));
    if (!rawValue) {
      return null;
    }
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function persistWarehouseId(openid: string, warehouseId: number | null) {
  try {
    const storageKey = getScopeStorageKey(openid);
    if (warehouseId === null) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, String(warehouseId));
  } catch {
    // Ignore localStorage failures and keep the session usable.
  }
}

export function TenantScopeProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [activeWarehouseId, setActiveWarehouseIdState] = useState<number | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["scope", "warehouses", session?.openid],
    queryFn: () =>
      apiGet<PaginatedResponse<WarehouseRecord>>("/api/warehouse/", {
        page: 1,
        page_size: 100,
      }),
    enabled: Boolean(session),
  });

  const warehouses = warehousesQuery.data?.results ?? [];

  useEffect(() => {
    if (!session) {
      setActiveWarehouseIdState(null);
      return;
    }
    setActiveWarehouseIdState(loadStoredWarehouseId(session.openid));
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (warehouses.length === 0) {
      persistWarehouseId(session.openid, null);
      setActiveWarehouseIdState(null);
      return;
    }

    const activeWarehouseStillExists = warehouses.some((warehouse) => warehouse.id === activeWarehouseId);
    if (activeWarehouseStillExists) {
      persistWarehouseId(session.openid, activeWarehouseId);
      return;
    }

    const nextWarehouseId = warehouses[0]?.id ?? null;
    setActiveWarehouseIdState(nextWarehouseId);
    persistWarehouseId(session.openid, nextWarehouseId);
  }, [activeWarehouseId, session, warehouses]);

  const setActiveWarehouseId = useCallback(
    (warehouseId: number | null) => {
      setActiveWarehouseIdState(warehouseId);
      if (session) {
        persistWarehouseId(session.openid, warehouseId);
      }
    },
    [session],
  );

  const activeWarehouse = warehouses.find((warehouse) => warehouse.id === activeWarehouseId) ?? warehouses[0] ?? null;

  const company = useMemo<CompanyContextRecord | null>(() => {
    if (!session) {
      return null;
    }
    return {
      id: session.openid,
      openid: session.openid,
      label: `${session.username} workspace`,
      description: "Current tenant context. This maps to company/tenant scope until a dedicated company API exists.",
    };
  }, [session]);

  const value = useMemo<TenantScopeContextValue>(
    () => ({
      company,
      warehouses,
      warehousesQuery,
      activeWarehouseId: activeWarehouse?.id ?? null,
      activeWarehouse,
      setActiveWarehouseId,
    }),
    [activeWarehouse, company, setActiveWarehouseId, warehouses, warehousesQuery],
  );

  return <TenantScopeContext.Provider value={value}>{children}</TenantScopeContext.Provider>;
}

export function useTenantScope() {
  const context = useContext(TenantScopeContext);
  if (!context) {
    throw new Error("useTenantScope must be used within TenantScopeProvider");
  }
  return context;
}
