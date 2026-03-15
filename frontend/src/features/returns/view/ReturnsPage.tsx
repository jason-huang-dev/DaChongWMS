import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useReturnsController } from "@/features/returns/controller/useReturnsController";
import { CreateReturnOrderPanel } from "@/features/returns/view/components/CreateReturnOrderPanel";
import { ReturnsTable } from "@/features/returns/view/ReturnsTable";
import { ReturnDispositionPanel } from "@/features/returns/view/components/ReturnDispositionPanel";
import { ReturnReceiptPanel } from "@/features/returns/view/components/ReturnReceiptPanel";
import { PageHeader } from "@/shared/components/page-header";

export function ReturnsPage() {
  const {
    activeWarehouse,
    returnOrderErrorMessage,
    returnOrderMutation,
    returnOrderSuccessMessage,
    dispositionErrorMessage,
    dispositionMutation,
    dispositionSuccessMessage,
    dispositionsQuery,
    dispositionsView,
    receiptErrorMessage,
    receiptMutation,
    receiptSuccessMessage,
    receiptsQuery,
    receiptsView,
    returnOrdersQuery,
    returnOrdersView,
  } = useReturnsController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="View return orders and post return receipts or dispositions from one operational surface."
        title="Returns operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <CreateReturnOrderPanel
            errorMessage={returnOrderErrorMessage}
            isPending={returnOrderMutation.isPending}
            onSubmit={(values, salesOrder) => returnOrderMutation.mutateAsync({ salesOrder, values })}
            successMessage={returnOrderSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ReturnReceiptPanel
            errorMessage={receiptErrorMessage}
            isPending={receiptMutation.isPending}
            onSubmit={async (values) => receiptMutation.mutateAsync(values)}
            successMessage={receiptSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ReturnDispositionPanel
            errorMessage={dispositionErrorMessage}
            isPending={dispositionMutation.isPending}
            onSubmit={async (values) => dispositionMutation.mutateAsync(values)}
            successMessage={dispositionSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ReturnsTable
            activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
            dispositionsQuery={dispositionsQuery}
            dispositionsView={dispositionsView}
            receiptsQuery={receiptsQuery}
            receiptsView={receiptsView}
            returnOrdersQuery={returnOrdersQuery}
            returnOrdersView={returnOrdersView}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
