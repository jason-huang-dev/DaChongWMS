import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

const pageSize = 8;

async function invalidateFinanceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["finance"], ["dashboard"]]);
}

export function useReportingController() {
  return {
    invoicesQuery: usePaginatedResource<InvoiceRecord>(["finance", "invoices"], reportingApi.invoices, 1, pageSize),
    settlementsQuery: usePaginatedResource<InvoiceSettlementRecord>(
      ["finance", "settlements"],
      reportingApi.invoiceSettlements,
      1,
      pageSize,
    ),
    disputesQuery: usePaginatedResource<InvoiceDisputeRecord>(
      ["finance", "disputes"],
      reportingApi.invoiceDisputes,
      1,
      pageSize,
    ),
    exportsQuery: usePaginatedResource<FinanceExportRecord>(
      ["finance", "exports"],
      reportingApi.financeExports,
      1,
      pageSize,
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
