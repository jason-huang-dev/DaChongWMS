import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import {
  runWorkOrderCreate,
  runWorkOrderTypeCreate,
  runWorkOrderTypeUpdate,
  runWorkOrderUpdate,
} from "@/features/work-orders/controller/actions";
import { buildWorkOrdersPath, buildWorkOrderTypesPath } from "@/features/work-orders/model/api";
import {
  defaultWorkOrderFormValues,
  defaultWorkOrderTypeFormValues,
  mapWorkOrderFormToPayload,
  mapWorkOrderToFormValues,
  mapWorkOrderTypeFormToPayload,
  mapWorkOrderTypeToFormValues,
} from "@/features/work-orders/model/mappers";
import type {
  WorkOrderFormValues,
  WorkOrderRecord,
  WorkOrderTypeFormValues,
  WorkOrderTypeRecord,
} from "@/features/work-orders/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface FeedbackState {
  successMessage: string | null;
  errorMessage: string | null;
}

function emptyFeedback(): FeedbackState {
  return {
    successMessage: null,
    errorMessage: null,
  };
}

function matchesToggleFilter(filterValue: string, currentValue: boolean) {
  if (filterValue === "") {
    return true;
  }
  return filterValue === "true" ? currentValue : !currentValue;
}

export function useWorkOrdersController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, warehouses } = useTenantScope();
  const [selectedWorkOrderType, setSelectedWorkOrderType] = useState<WorkOrderTypeRecord | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [typeFeedback, setTypeFeedback] = useState<FeedbackState>(emptyFeedback);
  const [workOrderFeedback, setWorkOrderFeedback] = useState<FeedbackState>(emptyFeedback);

  const typeView = useDataView({
    viewKey: `work-orders.types.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      name: "",
      code: "",
      workstream: "",
      is_active: "",
    },
    pageSize: 8,
  });

  const workOrderView = useDataView({
    viewKey: `work-orders.queue.${company?.openid ?? "anonymous"}.${activeWarehouse?.id ?? "all"}`,
    defaultFilters: {
      search: "",
      status: "",
      urgency: "",
      workstream: "",
      sla_status: "",
      assignee_name: "",
    },
    pageSize: 10,
  });

  const workOrderTypesQuery = useResource<WorkOrderTypeRecord[]>(
    ["work-orders", "types", company?.id],
    buildWorkOrderTypesPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const workOrdersQuery = useResource<WorkOrderRecord[]>(
    ["work-orders", "queue", company?.id, activeWarehouse?.id ?? "all"],
    buildWorkOrdersPath(company?.id ?? "0"),
    activeWarehouse?.id ? { warehouse_id: activeWarehouse.id } : undefined,
    { enabled: Boolean(company?.id) },
  );

  const customerAccountsQuery = useResource<ClientAccountRecord[]>(
    ["work-orders", "customer-accounts", company?.id],
    buildClientAccountsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const workOrderTypes = workOrderTypesQuery.data ?? [];
  const workOrders = workOrdersQuery.data ?? [];
  const customerAccounts = customerAccountsQuery.data ?? [];

  useEffect(() => {
    if (!selectedWorkOrderType) {
      return;
    }
    const stillExists = workOrderTypes.some((workOrderType) => workOrderType.id === selectedWorkOrderType.id);
    if (!stillExists) {
      setSelectedWorkOrderType(null);
    }
  }, [selectedWorkOrderType, workOrderTypes]);

  useEffect(() => {
    if (!selectedWorkOrder) {
      return;
    }
    const stillExists = workOrders.some((workOrder) => workOrder.id === selectedWorkOrder.id);
    if (!stillExists) {
      setSelectedWorkOrder(null);
    }
  }, [selectedWorkOrder, workOrders]);

  const filteredWorkOrderTypes = useMemo(() => {
    const normalizedName = typeView.filters.name.trim().toLowerCase();
    const normalizedCode = typeView.filters.code.trim().toLowerCase();

    return workOrderTypes.filter((workOrderType) => {
      if (normalizedName && !workOrderType.name.toLowerCase().includes(normalizedName)) {
        return false;
      }
      if (normalizedCode && !workOrderType.code.toLowerCase().includes(normalizedCode)) {
        return false;
      }
      if (typeView.filters.workstream && workOrderType.workstream !== typeView.filters.workstream) {
        return false;
      }
      if (!matchesToggleFilter(typeView.filters.is_active, workOrderType.is_active)) {
        return false;
      }
      return true;
    });
  }, [typeView.filters, workOrderTypes]);

  const pagedWorkOrderTypes = useMemo(() => {
    const startIndex = (typeView.page - 1) * typeView.pageSize;
    return filteredWorkOrderTypes.slice(startIndex, startIndex + typeView.pageSize);
  }, [filteredWorkOrderTypes, typeView.page, typeView.pageSize]);

  const filteredWorkOrders = useMemo(() => {
    const normalizedSearch = workOrderView.filters.search.trim().toLowerCase();
    const normalizedAssignee = workOrderView.filters.assignee_name.trim().toLowerCase();

    return workOrders.filter((workOrder) => {
      if (
        normalizedSearch &&
        ![
          workOrder.display_code,
          workOrder.title,
          workOrder.source_reference,
          workOrder.work_order_type_name,
          workOrder.customer_account_name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      if (workOrderView.filters.status && workOrder.status !== workOrderView.filters.status) {
        return false;
      }
      if (workOrderView.filters.urgency && workOrder.urgency !== workOrderView.filters.urgency) {
        return false;
      }
      if (workOrderView.filters.workstream && workOrder.workstream !== workOrderView.filters.workstream) {
        return false;
      }
      if (workOrderView.filters.sla_status && workOrder.sla_status !== workOrderView.filters.sla_status) {
        return false;
      }
      if (normalizedAssignee && !workOrder.assignee_name.toLowerCase().includes(normalizedAssignee)) {
        return false;
      }
      return true;
    });
  }, [workOrderView.filters, workOrders]);

  const pagedWorkOrders = useMemo(() => {
    const startIndex = (workOrderView.page - 1) * workOrderView.pageSize;
    return filteredWorkOrders.slice(startIndex, startIndex + workOrderView.pageSize);
  }, [filteredWorkOrders, workOrderView.page, workOrderView.pageSize]);

  const workOrderTypeDefaultValues = selectedWorkOrderType
    ? mapWorkOrderTypeToFormValues(selectedWorkOrderType)
    : defaultWorkOrderTypeFormValues;
  const workOrderDefaultValues = selectedWorkOrder
    ? mapWorkOrderToFormValues(selectedWorkOrder)
    : defaultWorkOrderFormValues;

  const invalidateWorkOrderQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["work-orders", "types", company?.id] }),
      queryClient.invalidateQueries({ queryKey: ["work-orders", "queue", company?.id] }),
    ]);
  };

  const createWorkOrderTypeMutation = useMutation({
    mutationFn: (values: WorkOrderTypeFormValues) => {
      if (!company?.id) {
        throw new Error("No active workspace selected");
      }
      return runWorkOrderTypeCreate(company.id, mapWorkOrderTypeFormToPayload(values));
    },
    onSuccess: async (workOrderType) => {
      setTypeFeedback({ successMessage: `Work order type ${workOrderType.name} created.`, errorMessage: null });
      setSelectedWorkOrderType(workOrderType);
      await invalidateWorkOrderQueries();
    },
    onError: (error) => {
      setTypeFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateWorkOrderTypeMutation = useMutation({
    mutationFn: (values: WorkOrderTypeFormValues) => {
      if (!company?.id || !selectedWorkOrderType) {
        throw new Error("No work order type selected");
      }
      return runWorkOrderTypeUpdate(
        company.id,
        selectedWorkOrderType.id,
        mapWorkOrderTypeFormToPayload(values),
      );
    },
    onSuccess: async (workOrderType) => {
      setTypeFeedback({ successMessage: `Work order type ${workOrderType.name} updated.`, errorMessage: null });
      setSelectedWorkOrderType(workOrderType);
      await invalidateWorkOrderQueries();
    },
    onError: (error) => {
      setTypeFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: (values: WorkOrderFormValues) => {
      if (!company?.id) {
        throw new Error("No active workspace selected");
      }
      return runWorkOrderCreate(company.id, mapWorkOrderFormToPayload(values));
    },
    onSuccess: async (workOrder) => {
      setWorkOrderFeedback({ successMessage: `Work order ${workOrder.display_code} created.`, errorMessage: null });
      setSelectedWorkOrder(workOrder);
      await invalidateWorkOrderQueries();
    },
    onError: (error) => {
      setWorkOrderFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: (values: WorkOrderFormValues) => {
      if (!company?.id || !selectedWorkOrder) {
        throw new Error("No work order selected");
      }
      return runWorkOrderUpdate(company.id, selectedWorkOrder.id, mapWorkOrderFormToPayload(values));
    },
    onSuccess: async (workOrder) => {
      setWorkOrderFeedback({ successMessage: `Work order ${workOrder.display_code} updated.`, errorMessage: null });
      setSelectedWorkOrder(workOrder);
      await invalidateWorkOrderQueries();
    },
    onError: (error) => {
      setWorkOrderFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const openWorkOrders = filteredWorkOrders.filter(
    (workOrder) => !["COMPLETED", "CANCELLED"].includes(workOrder.status),
  );
  const topRankedWorkOrder = openWorkOrders[0] ?? null;

  return {
    company,
    activeWarehouse,
    warehouses,
    customerAccounts,
    selectedWorkOrderType,
    selectedWorkOrder,
    setSelectedWorkOrderType,
    setSelectedWorkOrder,
    clearWorkOrderTypeSelection: () => {
      setSelectedWorkOrderType(null);
      setTypeFeedback(emptyFeedback());
    },
    clearWorkOrderSelection: () => {
      setSelectedWorkOrder(null);
      setWorkOrderFeedback(emptyFeedback());
    },
    workOrderTypeDefaultValues,
    workOrderDefaultValues,
    isEditingWorkOrderType: Boolean(selectedWorkOrderType),
    isEditingWorkOrder: Boolean(selectedWorkOrder),
    typeFeedback,
    workOrderFeedback,
    createWorkOrderTypeMutation,
    updateWorkOrderTypeMutation,
    createWorkOrderMutation,
    updateWorkOrderMutation,
    workOrderTypesQuery,
    workOrdersQuery,
    workOrderTypeView: typeView,
    workOrderView,
    pagedWorkOrderTypes,
    filteredWorkOrderTypeCount: filteredWorkOrderTypes.length,
    pagedWorkOrders,
    filteredWorkOrderCount: filteredWorkOrders.length,
    workOrderTypes,
    workOrders,
    summary: {
      totalTypes: workOrderTypes.length,
      activeTypes: workOrderTypes.filter((workOrderType) => workOrderType.is_active).length,
      totalWorkOrders: workOrders.length,
      openWorkOrders: openWorkOrders.length,
      criticalWorkOrders: openWorkOrders.filter((workOrder) => workOrder.urgency === "CRITICAL").length,
      dueSoonWorkOrders: openWorkOrders.filter((workOrder) => workOrder.sla_status === "DUE_SOON").length,
      overdueWorkOrders: openWorkOrders.filter((workOrder) => workOrder.sla_status === "OVERDUE").length,
      inProgressWorkOrders: openWorkOrders.filter((workOrder) => workOrder.status === "IN_PROGRESS").length,
      pendingReviewWorkOrders: openWorkOrders.filter((workOrder) => workOrder.status === "PENDING_REVIEW").length,
      topRankedWorkOrder,
    },
  };
}

