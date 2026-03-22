import { useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runClientAccountCreate, runClientAccountUpdate } from "@/features/clients/controller/actions";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import { defaultClientAccountFormValues, mapClientAccountToFormValues } from "@/features/clients/model/mappers";
import type { ClientAccountFormValues, ClientAccountRecord } from "@/features/clients/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

function matchesToggleFilter(filterValue: string, currentValue: boolean) {
  if (filterValue === "") {
    return true;
  }
  return filterValue === "true" ? currentValue : !currentValue;
}

export function useClientsController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse } = useTenantScope();
  const [selectedClient, setSelectedClient] = useState<ClientAccountRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientView = useDataView({
    viewKey: `clients.accounts.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      name: "",
      code: "",
      is_active: "",
      allow_dropshipping_orders: "",
      allow_inbound_goods: "",
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
  const filteredClients = useMemo(() => {
    const normalizedName = clientView.filters.name.trim().toLowerCase();
    const normalizedCode = clientView.filters.code.trim().toLowerCase();

    return allClients.filter((client) => {
      if (normalizedName && !client.name.toLowerCase().includes(normalizedName)) {
        return false;
      }
      if (normalizedCode && !client.code.toLowerCase().includes(normalizedCode)) {
        return false;
      }
      if (!matchesToggleFilter(clientView.filters.is_active, client.is_active)) {
        return false;
      }
      if (!matchesToggleFilter(clientView.filters.allow_dropshipping_orders, client.allow_dropshipping_orders)) {
        return false;
      }
      if (!matchesToggleFilter(clientView.filters.allow_inbound_goods, client.allow_inbound_goods)) {
        return false;
      }
      return true;
    });
  }, [allClients, clientView.filters]);

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

  return {
    company,
    activeWarehouse,
    selectedClient,
    setSelectedClient,
    clearSelection: () => {
      setSelectedClient(null);
      setSuccessMessage(null);
      setErrorMessage(null);
    },
    defaultValues: selectedClient ? mapClientAccountToFormValues(selectedClient) : defaultClientAccountFormValues,
    isEditing: Boolean(selectedClient),
    clientView,
    clientsQuery,
    pagedClients,
    filteredClientCount: filteredClients.length,
    summary: {
      total: allClients.length,
      active: allClients.filter((client) => client.is_active).length,
      dropshipEnabled: allClients.filter((client) => client.allow_dropshipping_orders).length,
      inboundEnabled: allClients.filter((client) => client.allow_inbound_goods).length,
    },
    createMutation,
    updateMutation,
    successMessage,
    errorMessage,
  };
}
