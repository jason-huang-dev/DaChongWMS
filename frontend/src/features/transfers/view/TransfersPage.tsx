import { Alert, Stack } from "@mui/material";

import { useTransfersController } from "@/features/transfers/controller/useTransfersController";
import { CreateTransferOrderPanel } from "@/features/transfers/view/components/CreateTransferOrderPanel";
import { TransfersTable } from "@/features/transfers/view/TransfersTable";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";

export function TransfersPage() {
  const {
    actionErrorMessage,
    actionSuccessMessage,
    completeTaskMutation,
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    generateTaskMutation,
    replenishmentRulesQuery,
    replenishmentTasksQuery,
    transferLinesQuery,
    transferOrdersQuery,
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
        isCompletingTask={completeTaskMutation.isPending}
        isGeneratingTask={generateTaskMutation.isPending}
        onCompleteTask={(replenishmentTaskId) => completeTaskMutation.mutate(replenishmentTaskId)}
        onGenerateTask={(replenishmentRuleId) => generateTaskMutation.mutate(replenishmentRuleId)}
        replenishmentRulesQuery={replenishmentRulesQuery}
        replenishmentTasksQuery={replenishmentTasksQuery}
        transferLinesQuery={transferLinesQuery}
        transferOrdersQuery={transferOrdersQuery}
      />
    </Stack>
  );
}
