import Grid from "@mui/material/Grid";
import { Alert, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useWorkOrdersController } from "@/features/work-orders/controller/useWorkOrdersController";
import { WorkOrderForm } from "@/features/work-orders/view/WorkOrderForm";
import { WorkOrderTable } from "@/features/work-orders/view/WorkOrderTable";
import { WorkOrderTypeForm } from "@/features/work-orders/view/WorkOrderTypeForm";
import { WorkOrderTypeTable } from "@/features/work-orders/view/WorkOrderTypeTable";
import { PageHeader } from "@/shared/components/page-header";
import { SummaryCard } from "@/shared/components/summary-card";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function WorkOrdersPage() {
  const { t, translate, msg } = useI18n();
  const {
    company,
    activeWarehouse,
    warehouses,
    customerAccounts,
    selectedWorkOrder,
    clearWorkOrderSelection,
    clearWorkOrderTypeSelection,
    createWorkOrderMutation,
    createWorkOrderTypeMutation,
    filteredWorkOrderCount,
    filteredWorkOrderTypeCount,
    isEditingWorkOrder,
    isEditingWorkOrderType,
    pagedWorkOrders,
    pagedWorkOrderTypes,
    selectedWorkOrderType,
    setSelectedWorkOrder,
    setSelectedWorkOrderType,
    summary,
    typeFeedback,
    updateWorkOrderMutation,
    updateWorkOrderTypeMutation,
    workOrderDefaultValues,
    workOrderFeedback,
    workOrderTypeDefaultValues,
    workOrdersQuery,
    workOrderTypes,
    workOrderTypesQuery,
    workOrderTypeView,
    workOrderView,
  } = useWorkOrdersController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Plan fulfillment sequencing, make urgency visible, and maintain reusable work-order types in the same warehouse-scoped workspace."
        title="Work order management"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current workspace and warehouse scope for work-order scheduling."
            items={[
              { label: "Workspace", value: company?.label ?? t("No workspace selected") },
              { label: "Warehouse context", value: activeWarehouse?.warehouse_name ?? t("All warehouses") },
              { label: "Selected work order", value: selectedWorkOrder?.display_code ?? t("None") },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Execution queue pressure in the current filtered view."
            items={[
              { label: "Open work orders", value: String(summary.openWorkOrders) },
              { label: "Critical work orders", value: String(summary.criticalWorkOrders) },
              { label: "Due soon", value: String(summary.dueSoonWorkOrders) },
              { label: "Overdue", value: String(summary.overdueWorkOrders) },
            ]}
            title="Queue pressure"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Review and execution posture for the current queue."
            items={[
              { label: "Pending review", value: String(summary.pendingReviewWorkOrders) },
              { label: "In progress", value: String(summary.inProgressWorkOrders) },
              { label: "Top ranked work order", value: summary.topRankedWorkOrder?.display_code ?? t("None") },
              { label: "Top ranked title", value: summary.topRankedWorkOrder?.title ?? "--" },
            ]}
            title="Fulfillment order"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Reusable templates that drive default urgency and SLA settings."
            items={[
              { label: "Work order types", value: String(summary.totalTypes) },
              { label: "Active types", value: String(summary.activeTypes) },
              { label: "Visible work orders", value: String(filteredWorkOrderCount) },
              { label: "Visible types", value: String(filteredWorkOrderTypeCount) },
            ]}
            title="Templates"
          />
        </Grid>
        {!company ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">{t("Select an active workspace membership before managing work orders.")}</Alert>
          </Grid>
        ) : null}
        <Grid size={{ xs: 12, xl: 4 }}>
          <WorkOrderTypeForm
            defaultValues={workOrderTypeDefaultValues}
            errorMessage={typeFeedback.errorMessage}
            isEditing={isEditingWorkOrderType}
            isSubmitting={createWorkOrderTypeMutation.isPending || updateWorkOrderTypeMutation.isPending}
            onCancelEdit={clearWorkOrderTypeSelection}
            onSubmit={(values) =>
              selectedWorkOrderType
                ? updateWorkOrderTypeMutation.mutateAsync(values)
                : createWorkOrderTypeMutation.mutateAsync(values)
            }
            successMessage={typeFeedback.successMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <WorkOrderTypeTable
            dataView={workOrderTypeView}
            error={workOrderTypesQuery.error ? parseApiError(workOrderTypesQuery.error) : null}
            isLoading={workOrderTypesQuery.isLoading}
            onEdit={setSelectedWorkOrderType}
            total={filteredWorkOrderTypeCount}
            workOrderTypes={pagedWorkOrderTypes}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <WorkOrderForm
            customerAccounts={customerAccounts}
            defaultValues={workOrderDefaultValues}
            errorMessage={workOrderFeedback.errorMessage}
            isEditing={isEditingWorkOrder}
            isSubmitting={createWorkOrderMutation.isPending || updateWorkOrderMutation.isPending}
            onCancelEdit={clearWorkOrderSelection}
            onSubmit={(values) =>
              selectedWorkOrder ? updateWorkOrderMutation.mutateAsync(values) : createWorkOrderMutation.mutateAsync(values)
            }
            successMessage={workOrderFeedback.successMessage}
            warehouses={warehouses}
            workOrderTypes={workOrderTypes}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <WorkOrderTable
            activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
            companyLabel={company?.label ?? null}
            dataView={workOrderView}
            error={workOrdersQuery.error ? parseApiError(workOrdersQuery.error) : null}
            isLoading={workOrdersQuery.isLoading}
            onEdit={setSelectedWorkOrder}
            total={filteredWorkOrderCount}
            workOrders={pagedWorkOrders}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
