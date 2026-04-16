import { useSearchParams } from "react-router-dom";

import { useInboundController } from "@/features/inbound/controller/useInboundController";

export function useInboundWorkspaceController() {
  const [searchParams] = useSearchParams();

  return useInboundController({
    initialAdvanceShipmentNoticeFilters: {
      asn_number__icontains: searchParams.get("asnNumber") ?? "",
      status: searchParams.get("asnStatus") ?? "",
      status__in: searchParams.get("asnStatuses") ?? "",
    },
    initialPurchaseOrderFilters: {
      po_number__icontains: searchParams.get("poNumber") ?? "",
      status: searchParams.get("poStatus") ?? "",
      status__in: searchParams.get("poStatuses") ?? "",
    },
    initialReceiptFilters: {
      receipt_number__icontains: searchParams.get("receiptNumber") ?? "",
      status: searchParams.get("receiptStatus") ?? "",
    },
    initialSigningRecordFilters: {
      signing_number__icontains: searchParams.get("signingNumber") ?? "",
      carrier_name__icontains: searchParams.get("carrierName") ?? "",
    },
    initialImportBatchFilters: {
      batch_number__icontains: searchParams.get("importBatchNumber") ?? "",
      status: searchParams.get("importStatus") ?? "",
    },
    initialPutawayTaskFilters: {
      task_number__icontains: searchParams.get("putawayTaskNumber") ?? "",
      status: searchParams.get("putawayStatus") ?? "",
      status__in: searchParams.get("putawayStatuses") ?? "",
    },
    initialReturnOrderFilters: {
      return_number__icontains: searchParams.get("returnNumber") ?? "",
      status: searchParams.get("returnOrderStatus") ?? "",
      status__in: searchParams.get("returnOrderStatuses") ?? "",
    },
  });
}
