import { useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runClientAccountCreate, runClientAccountUpdate } from "@/features/clients/controller/actions";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import {
  matchesClientMetricRange,
  matchesClientSearch,
  matchesClientTimeRange,
  resolveClientLifecycleStatus,
  type ClientCompanySearchField,
  type ClientCustomerSearchField,
  type ClientMetricField,
  type ClientSetupSearchField,
  type ClientTimeField,
} from "@/features/clients/model/client-accounts";
import { defaultClientAccountFormValues, mapClientAccountToFormValues } from "@/features/clients/model/mappers";
import type {
  ClientAccountFormValues,
  ClientAccountRecord,
  ClientLifecycleStatus,
} from "@/features/clients/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

type ClientEditorMode = "create" | "edit" | null;

export interface ClientWorkbenchFilters {
  [key: string]: string;
  customerField: ClientCustomerSearchField;
  customerQuery: string;
  companyField: ClientCompanySearchField;
  companyQuery: string;
  financeField: ClientMetricField;
  financeMin: string;
  financeMax: string;
  setupField: ClientSetupSearchField;
  setupQuery: string;
  timeField: ClientTimeField;
  timeStart: string;
  timeEnd: string;
}

export function useClientsController(lifecycleBucket: ClientLifecycleStatus) {
  const queryClient = useQueryClient();
  const { company } = useTenantScope();
  const [selectedClient, setSelectedClient] = useState<ClientAccountRecord | null>(null);
  const [editorMode, setEditorMode] = useState<ClientEditorMode>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientView = useDataView<ClientWorkbenchFilters>({
    viewKey: `clients.accounts.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      customerField: "customerCode",
      customerQuery: "",
      companyField: "companyName",
      companyQuery: "",
      financeField: "availableBalance",
      financeMin: "",
      financeMax: "",
      setupField: "chargingTemplate",
      setupQuery: "",
      timeField: "createdDate",
      timeStart: "",
      timeEnd: "",
    },
    pageSize: 10,
  });

  const clientsQuery = useResource<ClientAccountRecord[]>(
    ["clients", "accounts", company?.id],
    buildClientAccountsPath(company?.id ?? "0"),
    undefined,
    { enabled: Boolean(company?.id) },
  );

  const allClients = clientsQuery.data ?? [];
  const lifecycleCounts = useMemo(
    () =>
      allClients.reduce<Record<ClientLifecycleStatus, number>>(
        (counts, client) => {
          counts[resolveClientLifecycleStatus(client)] += 1;
          return counts;
        },
        {
          PENDING_APPROVAL: 0,
          APPROVED: 0,
          REVIEW_NOT_APPROVED: 0,
          DEACTIVATED: 0,
        },
      ),
    [allClients],
  );

  const filteredClients = useMemo(() => {
    return allClients.filter((client) => {
      if (resolveClientLifecycleStatus(client) !== lifecycleBucket) {
        return false;
      }
      if (!matchesClientSearch(client, clientView.filters.customerField, clientView.filters.customerQuery)) {
        return false;
      }
      if (!matchesClientSearch(client, clientView.filters.companyField, clientView.filters.companyQuery)) {
        return false;
      }
      if (!matchesClientMetricRange(client, clientView.filters.financeField, clientView.filters.financeMin, clientView.filters.financeMax)) {
        return false;
      }
      if (!matchesClientSearch(client, clientView.filters.setupField, clientView.filters.setupQuery)) {
        return false;
      }
      if (
        !matchesClientTimeRange(client, clientView.filters.timeField, clientView.filters.timeStart, clientView.filters.timeEnd)
      ) {
        return false;
      }
      return true;
    });
  }, [allClients, clientView.filters, lifecycleBucket]);

  const pagedClients = useMemo(() => {
    const startIndex = (clientView.page - 1) * clientView.pageSize;
    return filteredClients.slice(startIndex, startIndex + clientView.pageSize);
  }, [clientView.page, clientView.pageSize, filteredClients]);

  const createMutation = useMutation({
    mutationFn: (values: ClientAccountFormValues) => {
      if (!company?.id) {
        throw new Error("No active workspace selected");
      }
      return runClientAccountCreate(company.id, values);
    },
    onSuccess: async (client) => {
      setErrorMessage(null);
      setSuccessMessage(`Client account for ${client.name} opened successfully.`);
      setSelectedClient(null);
      setEditorMode(null);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: ClientAccountFormValues) => {
      if (!company?.id || !selectedClient) {
        throw new Error("No client selected");
      }
      return runClientAccountUpdate(company.id, selectedClient.id, values);
    },
    onSuccess: async (client) => {
      setErrorMessage(null);
      setSuccessMessage(`Client ${client.name} updated.`);
      setSelectedClient(client);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  async function setClientsActiveState(clients: ClientAccountRecord[], isActive: boolean) {
    if (!company?.id) {
      throw new Error("No active workspace selected");
    }
    if (clients.length === 0) {
      return;
    }

    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updatedClients: ClientAccountRecord[] = [];

      for (const client of clients) {
        const updatedClient = await runClientAccountUpdate(company.id, client.id, {
          ...mapClientAccountToFormValues(client),
          is_active: isActive,
        });
        updatedClients.push(updatedClient);
      }

      const updatedSelectedClient = selectedClient
        ? updatedClients.find((client) => client.id === selectedClient.id) ?? null
        : null;

      if (updatedSelectedClient) {
        setSelectedClient(updatedSelectedClient);
      }

      setSuccessMessage(
        clients.length === 1
          ? `Client ${clients[0].name} ${isActive ? "reactivated" : "deactivated"}.`
          : `${clients.length} client accounts ${isActive ? "reactivated" : "deactivated"}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (error) {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
      throw error;
    }
  }

  return {
    company,
    allClients,
    selectedClient,
    openCreateEditor: () => {
      setSelectedClient(null);
      setSuccessMessage(null);
      setErrorMessage(null);
      setEditorMode("create");
    },
    openEditEditor: (client: ClientAccountRecord) => {
      setSelectedClient(client);
      setSuccessMessage(null);
      setErrorMessage(null);
      setEditorMode("edit");
    },
    closeEditor: () => {
      setSelectedClient(null);
      setSuccessMessage(null);
      setErrorMessage(null);
      setEditorMode(null);
    },
    clearSuccessMessage: () => {
      setSuccessMessage(null);
    },
    defaultValues: editorMode === "edit" && selectedClient ? mapClientAccountToFormValues(selectedClient) : defaultClientAccountFormValues,
    isEditing: editorMode === "edit",
    isEditorOpen: editorMode !== null,
    clientView,
    lifecycleCounts,
    resetClientFilters: () => {
      clientView.resetFilters();
    },
    clientsQuery,
    filteredClients,
    pagedClients,
    filteredClientCount: filteredClients.length,
    createMutation,
    updateMutation,
    setClientsActiveState,
    successMessage,
    errorMessage,
  };
}
