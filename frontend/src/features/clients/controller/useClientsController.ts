import { useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runClientAccountCreate, runClientAccountUpdate } from "@/features/clients/controller/actions";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import {
  matchesClientSearch,
  resolveClientLifecycleStatus,
  type ClientSearchField,
  type ClientSearchMode,
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
  searchField: ClientSearchField;
  searchMode: ClientSearchMode;
  searchQuery: string;
  warehouse: string;
  chargingTemplate: string;
  settlementCurrency: string;
  contactPerson: string;
  distribution: string;
}

function matchesOptionalTextFilter(filterValue: string, currentValue?: string | null) {
  if (filterValue === "") {
    return true;
  }
  return currentValue === filterValue;
}

function matchesListFilter(filterValue: string, currentValues?: string[] | null) {
  if (filterValue === "") {
    return true;
  }
  return (currentValues ?? []).includes(filterValue);
}

function buildUniqueSortedValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
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
      searchField: "code",
      searchMode: "exact",
      searchQuery: "",
      warehouse: "",
      chargingTemplate: "",
      settlementCurrency: "",
      contactPerson: "",
      distribution: "",
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

  const filterOptions = useMemo(
    () => ({
      warehouses: buildUniqueSortedValues(allClients.flatMap((client) => client.warehouse_assignments ?? [])),
      chargingTemplates: buildUniqueSortedValues(allClients.map((client) => client.charging_template_name ?? "")),
      settlementCurrencies: buildUniqueSortedValues(allClients.map((client) => client.settlement_currency ?? "")),
      contactPeople: buildUniqueSortedValues(
        allClients.flatMap((client) =>
          [
            client.contact_name,
            ...(client.contact_people ?? []).map((person) => person.name),
          ].filter(Boolean) as string[],
        ),
      ),
      distributionModes: buildUniqueSortedValues(allClients.map((client) => client.distribution_mode ?? "")),
    }),
    [allClients],
  );

  const filteredClients = useMemo(() => {
    return allClients.filter((client) => {
      if (resolveClientLifecycleStatus(client) !== lifecycleBucket) {
        return false;
      }
      if (
        !matchesClientSearch(
          client,
          clientView.filters.searchField,
          clientView.filters.searchQuery,
          clientView.filters.searchMode,
        )
      ) {
        return false;
      }
      if (!matchesListFilter(clientView.filters.warehouse, client.warehouse_assignments)) {
        return false;
      }
      if (!matchesOptionalTextFilter(clientView.filters.chargingTemplate, client.charging_template_name)) {
        return false;
      }
      if (!matchesOptionalTextFilter(clientView.filters.settlementCurrency, client.settlement_currency)) {
        return false;
      }
      if (
        clientView.filters.contactPerson &&
        ![
          client.contact_name,
          ...(client.contact_people ?? []).map((person) => person.name),
        ].includes(clientView.filters.contactPerson)
      ) {
        return false;
      }
      if (!matchesOptionalTextFilter(clientView.filters.distribution, client.distribution_mode)) {
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
      setSuccessMessage(`Client ${client.name} created.`);
      setSelectedClient(client);
      setEditorMode("edit");
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
    defaultValues: editorMode === "edit" && selectedClient ? mapClientAccountToFormValues(selectedClient) : defaultClientAccountFormValues,
    isEditing: editorMode === "edit",
    isEditorOpen: editorMode !== null,
    clientView,
    lifecycleCounts,
    resetClientFilters: () => {
      clientView.resetFilters();
    },
    filterOptions,
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
