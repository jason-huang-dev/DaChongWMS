import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTenantScope } from "@/app/scope-context";
import { runInvoiceAction } from "@/features/reporting/controller/actions";
import { reportingApi } from "@/features/reporting/model/api";
import { defaultInvoiceActionValues } from "@/features/reporting/model/mappers";
import type {
  FinanceExportRecord,
  InvoiceAction,
  InvoiceActionValues,
  InvoiceDisputeRecord,
  InvoiceRecord,
  InvoiceSettlementRecord,
} from "@/features/reporting/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface ReportingControllerOptions {
  initialInvoiceFilters?: {
    invoice_number__icontains?: string;
    status?: string;
    "finance_approval__status"?: string;
  };
  initialSettlementFilters?: {
    status?: string;
  };
  initialDisputeFilters?: {
    status?: string;
    status__in?: string;
    reason_code?: string;
  };
  initialExportFilters?: {
    status?: string;
  };
}

async function invalidateFinanceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["finance"], ["dashboard"]]);
}

export function useReportingController(options: ReportingControllerOptions = {}) {
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const invoicesView = useDataView({
    viewKey: `finance.invoices.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      invoice_number__icontains: options.initialInvoiceFilters?.invoice_number__icontains ?? "",
      status: options.initialInvoiceFilters?.status ?? "",
      "finance_approval__status": options.initialInvoiceFilters?.["finance_approval__status"] ?? "",
    },
    pageSize: 8,
  });
  const settlementsView = useDataView({
    viewKey: `finance.settlements.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: options.initialSettlementFilters?.status ?? "",
    },
    pageSize: 8,
  });
  const disputesView = useDataView({
    viewKey: `finance.disputes.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: options.initialDisputeFilters?.status ?? "",
      status__in: options.initialDisputeFilters?.status__in ?? "",
      reason_code: options.initialDisputeFilters?.reason_code ?? "",
    },
    pageSize: 8,
  });
  const exportsView = useDataView({
    viewKey: `finance.exports.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: options.initialExportFilters?.status ?? "",
    },
    pageSize: 8,
  });

  return {
    activeWarehouse,
    invoicesView,
    invoicesQuery: usePaginatedResource<InvoiceRecord>(
      ["finance", "invoices"],
      reportingApi.invoices,
      invoicesView.page,
      invoicesView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...invoicesView.queryFilters,
      },
    ),
    settlementsView,
    settlementsQuery: usePaginatedResource<InvoiceSettlementRecord>(
      ["finance", "settlements"],
      reportingApi.invoiceSettlements,
      settlementsView.page,
      settlementsView.pageSize,
      {
        invoice__warehouse: activeWarehouseId ?? undefined,
        ...settlementsView.queryFilters,
      },
    ),
    disputesView,
    disputesQuery: usePaginatedResource<InvoiceDisputeRecord>(
      ["finance", "disputes"],
      reportingApi.invoiceDisputes,
      disputesView.page,
      disputesView.pageSize,
      {
        invoice__warehouse: activeWarehouseId ?? undefined,
        ...disputesView.queryFilters,
      },
    ),
    exportsView,
    exportsQuery: usePaginatedResource<FinanceExportRecord>(
      ["finance", "exports"],
      reportingApi.financeExports,
      exportsView.page,
      exportsView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...exportsView.queryFilters,
      },
    ),
  };
}

export function useInvoiceDetailController(invoiceId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invoiceQuery = useResource<InvoiceRecord>(
    ["finance", "invoices", invoiceId],
    `${reportingApi.invoices}${invoiceId}/`,
    undefined,
    { enabled: Boolean(invoiceId) },
  );

  const actionMutation = useMutation({
    mutationFn: ({ action, values }: { action: InvoiceAction; values: InvoiceActionValues }) =>
      runInvoiceAction(String(invoiceId), action, values),
    onSuccess: async (invoice) => {
      setErrorMessage(null);
      setSuccessMessage(`Invoice ${invoice.invoice_number} updated through ${invoice.status.toLowerCase()} workflow.`);
      await invalidateFinanceQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    invoiceQuery,
    actionMutation,
    successMessage,
    errorMessage,
    defaultValues: defaultInvoiceActionValues,
  };
}
