import { Alert, Stack } from "@mui/material";

import { useTransfersController } from "@/features/transfers/controller/useTransfersController";
import { CreateTransferOrderPanel } from "@/features/transfers/view/components/CreateTransferOrderPanel";
import { TransfersTable } from "@/features/transfers/view/TransfersTable";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";

export function TransfersPage() {
  const {
    activeWarehouse,
    actionErrorMessage,
    actionSuccessMessage,
    bulkArchiveMutation,
    completeTaskMutation,
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    generateTaskMutation,
    replenishmentRulesQuery,
    replenishmentRulesView,
    replenishmentTasksQuery,
    replenishmentTasksView,
    transferLinesQuery,
    transferLinesView,
    transferOrderSelection,
    transferOrdersQuery,
    transferOrdersView,
  } = useTransfersController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Monitor internal transfers and min-max replenishment work. Generate replenishment tasks from rules and complete generated tasks from the same view."
        title="Transfers and replenishment"
      />
      <CreateTransferOrderPanel
        errorMessage={createErrorMessage}
        isPending={createTransferOrderMutation.isPending}
        onSubmit={(values, balancesById) => createTransferOrderMutation.mutateAsync({ balancesById, values })}
        successMessage={createSuccessMessage}
      />
      <QueryAlert message={actionErrorMessage} />
      {actionSuccessMessage ? <Alert severity="success">{actionSuccessMessage}</Alert> : null}
      <TransfersTable
        activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
        isCompletingTask={completeTaskMutation.isPending}
        isGeneratingTask={generateTaskMutation.isPending}
        onCompleteTask={(replenishmentTaskId) => completeTaskMutation.mutate(replenishmentTaskId)}
        onGenerateTask={(replenishmentRuleId) => generateTaskMutation.mutate(replenishmentRuleId)}
        replenishmentRulesQuery={replenishmentRulesQuery}
        replenishmentRulesView={replenishmentRulesView}
        replenishmentTasksQuery={replenishmentTasksQuery}
        replenishmentTasksView={replenishmentTasksView}
        isArchivingOrders={bulkArchiveMutation.isPending}
        transferLinesQuery={transferLinesQuery}
        transferLinesView={transferLinesView}
        onArchiveTransferOrders={(transferOrderIds) => bulkArchiveMutation.mutate(transferOrderIds)}
        transferOrderSelection={transferOrderSelection}
        transferOrdersQuery={transferOrdersQuery}
        transferOrdersView={transferOrdersView}
      />
    </Stack>
  );
}
