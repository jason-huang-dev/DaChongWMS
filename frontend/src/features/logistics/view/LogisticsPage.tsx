import Grid from "@mui/material/Grid";
import { Alert, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useLogisticsController } from "@/features/logistics/controller/useLogisticsController";
import { LogisticsEditorCard, type LogisticsEditorField, type LogisticsEditorOption } from "@/features/logistics/view/components/LogisticsEditorCard";
import type {
  CustomerLogisticsChannelFormValues,
  FuelRuleFormValues,
  LogisticsChargeFormValues,
  LogisticsChargingStrategyFormValues,
  LogisticsCostFormValues,
  LogisticsGroupFormValues,
  LogisticsProviderChannelFormValues,
  LogisticsProviderFormValues,
  LogisticsRuleFormValues,
  PartitionRuleFormValues,
  RemoteAreaRuleFormValues,
  SpecialCustomerLogisticsChargingFormValues,
  WaybillWatermarkFormValues,
} from "@/features/logistics/model/types";
import { PageHeader } from "@/shared/components/page-header";
import { ResourceTable } from "@/shared/components/resource-table";
import { SummaryCard } from "@/shared/components/summary-card";
import { parseApiError } from "@/shared/utils/parse-api-error";

function buildOptions(records: Array<{ id: number; name?: string; code?: string; provider_name?: string; provider_channel_name?: string }>): LogisticsEditorOption[] {
  return records.map((record) => ({
    value: String(record.id),
    label: record.name ?? record.code ?? record.provider_name ?? record.provider_channel_name ?? String(record.id),
  }));
}

const providerTypeOptions: LogisticsEditorOption[] = [
  { value: "CARRIER", label: "Carrier" },
  { value: "AGGREGATOR", label: "Aggregator" },
  { value: "FORWARDER", label: "Forwarder" },
  { value: "IN_HOUSE", label: "In-house" },
];

const integrationModeOptions: LogisticsEditorOption[] = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "HYBRID", label: "Hybrid" },
];

const channelModeOptions: LogisticsEditorOption[] = [
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
];

const transportModeOptions: LogisticsEditorOption[] = [
  { value: "EXPRESS", label: "Express" },
  { value: "AIR", label: "Air" },
  { value: "GROUND", label: "Ground" },
  { value: "SEA", label: "Sea" },
  { value: "LOCAL", label: "Local" },
];

const ruleScopeOptions: LogisticsEditorOption[] = [
  { value: "GENERAL", label: "General" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
];

const watermarkPositionOptions: LogisticsEditorOption[] = [
  { value: "HEADER", label: "Header" },
  { value: "FOOTER", label: "Footer" },
  { value: "CENTER", label: "Center" },
  { value: "DIAGONAL", label: "Diagonal" },
];

const chargingBasisOptions: LogisticsEditorOption[] = [
  { value: "PER_ORDER", label: "Per order" },
  { value: "PER_PACKAGE", label: "Per package" },
  { value: "WEIGHT_BAND", label: "Weight band" },
  { value: "ORDER_VALUE", label: "Order value" },
];

const chargeStatusOptions: LogisticsEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "INVOICED", label: "Invoiced" },
];

const costStatusOptions: LogisticsEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "RECONCILED", label: "Reconciled" },
];

export function LogisticsPage() {
  const controller = useLogisticsController();
  const { translateText } = useI18n();
  const editActionLabel = translateText("Edit");
  const yesLabel = translateText("Yes");
  const noLabel = translateText("No");
  const anyLabel = translateText("Any");

  const renderEditAction = <TRecord,>(onSelect: (record: TRecord) => void) => (record: TRecord) => (
    <Typography component="button" onClick={() => onSelect(record)}>
      {editActionLabel}
    </Typography>
  );

  const providerFields: Array<LogisticsEditorField<LogisticsProviderFormValues>> = [
    { key: "code", label: "Provider code" },
    { key: "name", label: "Provider name" },
    { key: "provider_type", label: "Provider type", type: "select", options: providerTypeOptions },
    { key: "integration_mode", label: "Integration mode", type: "select", options: integrationModeOptions },
    { key: "contact_name", label: "Contact name" },
    { key: "account_number", label: "Account number" },
    { key: "supports_online_booking", label: "Supports online booking", type: "checkbox" },
    { key: "supports_offline_booking", label: "Supports offline booking", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
    { key: "is_active", label: "Active", type: "checkbox" },
  ];

  const logisticsGroupFields: Array<LogisticsEditorField<LogisticsGroupFormValues>> = [
    { key: "code", label: "Group code" },
    { key: "name", label: "Group name" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "is_active", label: "Active", type: "checkbox" },
  ];

  const providerOptions = buildOptions(controller.providers);
  const logisticsGroupOptions = buildOptions(controller.logisticsGroups);
  const providerChannelOptions = controller.providerChannels.map((channel) => ({
    value: String(channel.id),
    label: `${channel.provider_code} · ${channel.code}`,
  }));
  const customerAccountOptions = controller.customerAccounts.map((account) => ({
    value: String(account.id),
    label: `${account.code} · ${account.name}`,
  }));
  const warehouseOptions = controller.warehouses.map((warehouse) => ({
    value: String(warehouse.id),
    label: `${warehouse.code} · ${warehouse.name}`,
  }));
  const chargingStrategyOptions = controller.chargingStrategies.map((strategy) => ({
    value: String(strategy.id),
    label: strategy.name,
  }));

  const providerChannelFields: Array<LogisticsEditorField<LogisticsProviderChannelFormValues>> = [
    { key: "provider", label: "Provider", type: "select", options: providerOptions },
    { key: "logistics_group", label: "Logistics group", type: "select", options: [{ value: "", label: "None" }, ...logisticsGroupOptions] },
    { key: "code", label: "Channel code" },
    { key: "name", label: "Channel name" },
    { key: "channel_mode", label: "Channel mode", type: "select", options: channelModeOptions },
    { key: "transport_mode", label: "Transport mode", type: "select", options: transportModeOptions },
    { key: "service_level", label: "Service level" },
    { key: "billing_code", label: "Billing code" },
    { key: "supports_waybill", label: "Waybill enabled", type: "checkbox" },
    { key: "supports_tracking", label: "Tracking enabled", type: "checkbox" },
    { key: "supports_scanform", label: "Scanform enabled", type: "checkbox" },
    { key: "supports_manifest", label: "Manifest enabled", type: "checkbox" },
    { key: "supports_relabel", label: "Relabel support", type: "checkbox" },
    { key: "is_default", label: "Default channel", type: "checkbox" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const customerChannelFields: Array<LogisticsEditorField<CustomerLogisticsChannelFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: customerAccountOptions },
    { key: "provider_channel", label: "Provider channel", type: "select", options: providerChannelOptions },
    { key: "client_channel_name", label: "Customer channel name" },
    { key: "external_account_number", label: "External account no." },
    { key: "priority", label: "Priority", type: "number" },
    { key: "is_default", label: "Default channel", type: "checkbox" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const logisticsRuleFields: Array<LogisticsEditorField<LogisticsRuleFormValues>> = [
    { key: "name", label: "Rule name" },
    { key: "rule_scope", label: "Scope", type: "select", options: ruleScopeOptions },
    { key: "logistics_group", label: "Logistics group", type: "select", options: [{ value: "", label: "None" }, ...logisticsGroupOptions] },
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "None" }, ...providerChannelOptions] },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "All warehouses" }, ...warehouseOptions] },
    { key: "destination_country", label: "Country" },
    { key: "shipping_method", label: "Shipping method" },
    { key: "min_weight_kg", label: "Min weight kg", type: "number" },
    { key: "max_weight_kg", label: "Max weight kg", type: "number" },
    { key: "priority", label: "Priority", type: "number" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const partitionRuleFields: Array<LogisticsEditorField<PartitionRuleFormValues>> = [
    { key: "name", label: "Partition rule name" },
    { key: "logistics_group", label: "Logistics group", type: "select", options: [{ value: "", label: "None" }, ...logisticsGroupOptions] },
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "None" }, ...providerChannelOptions] },
    { key: "partition_key", label: "Partition key" },
    { key: "partition_value", label: "Partition value" },
    { key: "handling_action", label: "Handling action" },
    { key: "priority", label: "Priority", type: "number" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const remoteAreaRuleFields: Array<LogisticsEditorField<RemoteAreaRuleFormValues>> = [
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "Any channel" }, ...providerChannelOptions] },
    { key: "country_code", label: "Country code" },
    { key: "postal_code_pattern", label: "Postal code pattern" },
    { key: "city_name", label: "City" },
    { key: "surcharge_amount", label: "Surcharge", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "is_active", label: "Active", type: "checkbox" },
  ];

  const fuelRuleFields: Array<LogisticsEditorField<FuelRuleFormValues>> = [
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "Any channel" }, ...providerChannelOptions] },
    { key: "effective_from", label: "Effective from", type: "date" },
    { key: "effective_to", label: "Effective to", type: "date" },
    { key: "surcharge_percent", label: "Fuel %", type: "number" },
    { key: "minimum_charge", label: "Minimum charge", type: "number" },
    { key: "maximum_charge", label: "Maximum charge", type: "number" },
    { key: "is_active", label: "Active", type: "checkbox" },
  ];

  const waybillWatermarkFields: Array<LogisticsEditorField<WaybillWatermarkFormValues>> = [
    { key: "name", label: "Watermark name" },
    { key: "watermark_text", label: "Watermark text", type: "textarea" },
    { key: "position", label: "Position", type: "select", options: watermarkPositionOptions },
    { key: "opacity_percent", label: "Opacity %", type: "number" },
    { key: "applies_to_online", label: "Apply to online waybills", type: "checkbox" },
    { key: "applies_to_offline", label: "Apply to offline waybills", type: "checkbox" },
    { key: "is_active", label: "Active", type: "checkbox" },
  ];

  const chargingStrategyFields: Array<LogisticsEditorField<LogisticsChargingStrategyFormValues>> = [
    { key: "name", label: "Strategy name" },
    { key: "charging_basis", label: "Charging basis", type: "select", options: chargingBasisOptions },
    { key: "logistics_group", label: "Logistics group", type: "select", options: [{ value: "", label: "None" }, ...logisticsGroupOptions] },
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "None" }, ...providerChannelOptions] },
    { key: "currency", label: "Currency" },
    { key: "base_fee", label: "Base fee", type: "number" },
    { key: "unit_fee", label: "Unit fee", type: "number" },
    { key: "minimum_charge", label: "Minimum charge", type: "number" },
    { key: "includes_fuel_rule", label: "Include fuel rule", type: "checkbox" },
    { key: "includes_remote_area_fee", label: "Include remote area fee", type: "checkbox" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const specialCustomerChargingFields: Array<LogisticsEditorField<SpecialCustomerLogisticsChargingFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: customerAccountOptions },
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "Any channel" }, ...providerChannelOptions] },
    { key: "charging_strategy", label: "Charging strategy", type: "select", options: [{ value: "", label: "None" }, ...chargingStrategyOptions] },
    { key: "base_fee_override", label: "Base fee override", type: "number" },
    { key: "unit_fee_override", label: "Unit fee override", type: "number" },
    { key: "minimum_charge_override", label: "Minimum charge override", type: "number" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const logisticsChargeFields: Array<LogisticsEditorField<LogisticsChargeFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "Optional" }, ...providerChannelOptions] },
    { key: "charging_strategy", label: "Charging strategy", type: "select", options: [{ value: "", label: "Optional" }, ...chargingStrategyOptions] },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "source_reference", label: "Source reference" },
    { key: "billing_reference", label: "Billing reference" },
    { key: "status", label: "Charge status", type: "select", options: chargeStatusOptions },
    { key: "currency", label: "Currency" },
    { key: "base_amount", label: "Base amount", type: "number" },
    { key: "fuel_amount", label: "Fuel amount", type: "number" },
    { key: "remote_area_amount", label: "Remote area amount", type: "number" },
    { key: "surcharge_amount", label: "Other surcharge", type: "number" },
    { key: "charged_at", label: "Charged at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const logisticsCostFields: Array<LogisticsEditorField<LogisticsCostFormValues>> = [
    { key: "provider_channel", label: "Provider channel", type: "select", options: [{ value: "", label: "Optional" }, ...providerChannelOptions] },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "source_reference", label: "Source reference" },
    { key: "cost_reference", label: "Cost reference" },
    { key: "status", label: "Cost status", type: "select", options: costStatusOptions },
    { key: "currency", label: "Currency" },
    { key: "linehaul_amount", label: "Linehaul amount", type: "number" },
    { key: "fuel_amount", label: "Fuel amount", type: "number" },
    { key: "remote_area_amount", label: "Remote area amount", type: "number" },
    { key: "other_amount", label: "Other amount", type: "number" },
    { key: "incurred_at", label: "Incurred at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const isSubmitting = {
    provider: controller.providerMutations.createMutation.isPending || controller.providerMutations.updateMutation.isPending,
    group: controller.groupMutations.createMutation.isPending || controller.groupMutations.updateMutation.isPending,
    providerChannel:
      controller.providerChannelMutations.createMutation.isPending || controller.providerChannelMutations.updateMutation.isPending,
    customerChannel:
      controller.customerChannelMutations.createMutation.isPending || controller.customerChannelMutations.updateMutation.isPending,
    logisticsRule:
      controller.logisticsRuleMutations.createMutation.isPending || controller.logisticsRuleMutations.updateMutation.isPending,
    partitionRule:
      controller.partitionRuleMutations.createMutation.isPending || controller.partitionRuleMutations.updateMutation.isPending,
    remoteAreaRule:
      controller.remoteAreaRuleMutations.createMutation.isPending || controller.remoteAreaRuleMutations.updateMutation.isPending,
    fuelRule: controller.fuelRuleMutations.createMutation.isPending || controller.fuelRuleMutations.updateMutation.isPending,
    watermark:
      controller.waybillWatermarkMutations.createMutation.isPending || controller.waybillWatermarkMutations.updateMutation.isPending,
    chargingStrategy:
      controller.chargingStrategyMutations.createMutation.isPending || controller.chargingStrategyMutations.updateMutation.isPending,
    specialCustomer:
      controller.specialCustomerChargingMutations.createMutation.isPending ||
      controller.specialCustomerChargingMutations.updateMutation.isPending,
    logisticsCharge:
      controller.logisticsChargeMutations.createMutation.isPending || controller.logisticsChargeMutations.updateMutation.isPending,
    logisticsCost:
      controller.logisticsCostMutations.createMutation.isPending || controller.logisticsCostMutations.updateMutation.isPending,
  };

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Manage online and offline logistics channels, routing rules, surcharges, watermarking, charging, and carrier cost control in one workspace."
        title="Logistics"
      />
      {!controller.company ? (
        <Alert severity="info">{translateText("Select an active workspace membership before managing logistics.")}</Alert>
      ) : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 2 }}>
          <SummaryCard
            description="Provider-channel execution modes"
            items={[
              { label: "Online logistics", value: String(controller.summary.onlineChannelCount) },
              { label: "Offline logistics", value: String(controller.summary.offlineChannelCount) },
            ]}
            title="Mode coverage"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 2 }}>
          <SummaryCard
            description="Customer-specific routing assignments"
            items={[
              { label: "Customer channels", value: String(controller.summary.customerChannelCount) },
              { label: "Special charging", value: String(controller.specialCustomerChargingRules.length) },
            ]}
            title="Customer routing"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 2 }}>
          <SummaryCard
            description="Rule and surcharge footprint"
            items={[
              { label: "Active rules", value: String(controller.summary.activeRuleCount) },
              { label: "Fuel rules", value: String(controller.fuelRules.length) },
            ]}
            title="Rules"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Rating and billing workload"
            items={[
              { label: "Pending charges", value: String(controller.summary.pendingChargeCount) },
              { label: "Charging strategies", value: String(controller.chargingStrategies.length) },
            ]}
            title="Charging"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Carrier-side landed cost tracking"
            items={[
              { label: "Posted costs", value: String(controller.summary.postedCostCount) },
              { label: "Cost records", value: String(controller.logisticsCosts.length) },
            ]}
            title="Cost control"
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Online Logistics"
            subtitle="Active online-capable provider channels"
            rows={controller.onlineChannels}
            columns={[
              { header: "Provider", key: "provider", render: (row) => row.provider_name },
              { header: "Channel", key: "channel", render: (row) => row.name },
              { header: "Service level", key: "service", render: (row) => row.service_level || "--" },
              { header: "Tracking", key: "tracking", render: (row) => (row.supports_tracking ? yesLabel : noLabel) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.providerChannelsQuery.isLoading}
            error={controller.providerChannelsQuery.error ? parseApiError(controller.providerChannelsQuery.error) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Offline Logistics"
            subtitle="Active offline or manually-booked provider channels"
            rows={controller.offlineChannels}
            columns={[
              { header: "Provider", key: "provider", render: (row) => row.provider_name },
              { header: "Channel", key: "channel", render: (row) => row.name },
              { header: "Transport", key: "transport", render: (row) => row.transport_mode },
              { header: "Waybill", key: "waybill", render: (row) => (row.supports_waybill ? yesLabel : noLabel) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.providerChannelsQuery.isLoading}
            error={controller.providerChannelsQuery.error ? parseApiError(controller.providerChannelsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Provider Management"
            description="Create and update carrier, aggregator, or in-house provider masters."
            fields={providerFields}
            values={controller.providerSection.formValues}
            onChange={controller.providerSection.updateFormValue}
            onSubmit={() =>
              controller.providerSection.selectedRecord
                ? controller.providerMutations.updateMutation.mutateAsync(controller.providerSection.formValues)
                : controller.providerMutations.createMutation.mutateAsync(controller.providerSection.formValues)
            }
            onCancel={controller.providerSection.clearSelection}
            isEditing={Boolean(controller.providerSection.selectedRecord)}
            isSubmitting={isSubmitting.provider}
            successMessage={controller.providerMutations.feedback.successMessage}
            errorMessage={controller.providerMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Logistics providers"
            subtitle="Carrier and aggregator master records"
            rows={controller.providers}
            columns={[
              { header: "Code", key: "code", render: (row) => row.code },
              { header: "Name", key: "name", render: (row) => row.name },
              { header: "Type", key: "type", render: (row) => row.provider_type },
              { header: "Mode", key: "mode", render: (row) => row.integration_mode },
              { header: "Booking", key: "booking", render: (row) => `${row.supports_online_booking ? "Online" : ""}${row.supports_offline_booking ? " / Offline" : ""}`.trim() || "--" },
              { header: "Edit", key: "edit", render: renderEditAction(controller.providerSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.providersQuery.isLoading}
            error={controller.providersQuery.error ? parseApiError(controller.providersQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Group"
            description="Group channels and rules by routing strategy or customer segment."
            fields={logisticsGroupFields}
            values={controller.groupSection.formValues}
            onChange={controller.groupSection.updateFormValue}
            onSubmit={() =>
              controller.groupSection.selectedRecord
                ? controller.groupMutations.updateMutation.mutateAsync(controller.groupSection.formValues)
                : controller.groupMutations.createMutation.mutateAsync(controller.groupSection.formValues)
            }
            onCancel={controller.groupSection.clearSelection}
            isEditing={Boolean(controller.groupSection.selectedRecord)}
            isSubmitting={isSubmitting.group}
            successMessage={controller.groupMutations.feedback.successMessage}
            errorMessage={controller.groupMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Logistics groups"
            subtitle="Shared routing and rating groupings"
            rows={controller.logisticsGroups}
            columns={[
              { header: "Code", key: "code", render: (row) => row.code },
              { header: "Name", key: "name", render: (row) => row.name },
              { header: "Description", key: "description", render: (row) => row.description || "--" },
              { header: "Edit", key: "edit", render: renderEditAction(controller.groupSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.logisticsGroupsQuery.isLoading}
            error={controller.logisticsGroupsQuery.error ? parseApiError(controller.logisticsGroupsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Provider Channel Management"
            description="Maintain channel-level booking, labeling, and tracking capabilities."
            fields={providerChannelFields}
            values={controller.providerChannelSection.formValues}
            onChange={controller.providerChannelSection.updateFormValue}
            onSubmit={() =>
              controller.providerChannelSection.selectedRecord
                ? controller.providerChannelMutations.updateMutation.mutateAsync(controller.providerChannelSection.formValues)
                : controller.providerChannelMutations.createMutation.mutateAsync(controller.providerChannelSection.formValues)
            }
            onCancel={controller.providerChannelSection.clearSelection}
            isEditing={Boolean(controller.providerChannelSection.selectedRecord)}
            isSubmitting={isSubmitting.providerChannel}
            successMessage={controller.providerChannelMutations.feedback.successMessage}
            errorMessage={controller.providerChannelMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Provider channels"
            subtitle="Online and offline routing channels"
            rows={controller.providerChannels}
            columns={[
              { header: "Provider", key: "provider", render: (row) => row.provider_name },
              { header: "Channel", key: "channel", render: (row) => row.name },
              { header: "Mode", key: "mode", render: (row) => row.channel_mode },
              { header: "Group", key: "group", render: (row) => row.logistics_group_name || "--" },
              { header: "Edit", key: "edit", render: renderEditAction(controller.providerChannelSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.providerChannelsQuery.isLoading}
            error={controller.providerChannelsQuery.error ? parseApiError(controller.providerChannelsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Customer Logistics Channel"
            description="Assign customer accounts to preferred logistics channels."
            fields={customerChannelFields}
            values={controller.customerChannelSection.formValues}
            onChange={controller.customerChannelSection.updateFormValue}
            onSubmit={() =>
              controller.customerChannelSection.selectedRecord
                ? controller.customerChannelMutations.updateMutation.mutateAsync(controller.customerChannelSection.formValues)
                : controller.customerChannelMutations.createMutation.mutateAsync(controller.customerChannelSection.formValues)
            }
            onCancel={controller.customerChannelSection.clearSelection}
            isEditing={Boolean(controller.customerChannelSection.selectedRecord)}
            isSubmitting={isSubmitting.customerChannel}
            successMessage={controller.customerChannelMutations.feedback.successMessage}
            errorMessage={controller.customerChannelMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Customer logistics channels"
            subtitle="Customer-to-channel routing preferences"
            rows={controller.customerChannels}
            columns={[
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name },
              { header: "Priority", key: "priority", render: (row) => row.priority },
              { header: "Default", key: "default", render: (row) => (row.is_default ? yesLabel : noLabel) },
              { header: "Edit", key: "edit", render: renderEditAction(controller.customerChannelSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.customerChannelsQuery.isLoading}
            error={controller.customerChannelsQuery.error ? parseApiError(controller.customerChannelsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Rules"
            description="Define primary routing and eligibility rules."
            fields={logisticsRuleFields}
            values={controller.logisticsRuleSection.formValues}
            onChange={controller.logisticsRuleSection.updateFormValue}
            onSubmit={() =>
              controller.logisticsRuleSection.selectedRecord
                ? controller.logisticsRuleMutations.updateMutation.mutateAsync(controller.logisticsRuleSection.formValues)
                : controller.logisticsRuleMutations.createMutation.mutateAsync(controller.logisticsRuleSection.formValues)
            }
            onCancel={controller.logisticsRuleSection.clearSelection}
            isEditing={Boolean(controller.logisticsRuleSection.selectedRecord)}
            isSubmitting={isSubmitting.logisticsRule}
            successMessage={controller.logisticsRuleMutations.feedback.successMessage}
            errorMessage={controller.logisticsRuleMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Logistics rules"
            subtitle="Eligibility and routing rules"
            rows={controller.logisticsRules}
            columns={[
              { header: "Rule", key: "rule", render: (row) => row.name },
              { header: "Scope", key: "scope", render: (row) => row.rule_scope },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || "--" },
              { header: "Priority", key: "priority", render: (row) => row.priority },
              { header: "Edit", key: "edit", render: renderEditAction(controller.logisticsRuleSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.logisticsRulesQuery.isLoading}
            error={controller.logisticsRulesQuery.error ? parseApiError(controller.logisticsRulesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Partition Rules"
            description="Partition orders or accounts into specific handling lanes."
            fields={partitionRuleFields}
            values={controller.partitionRuleSection.formValues}
            onChange={controller.partitionRuleSection.updateFormValue}
            onSubmit={() =>
              controller.partitionRuleSection.selectedRecord
                ? controller.partitionRuleMutations.updateMutation.mutateAsync(controller.partitionRuleSection.formValues)
                : controller.partitionRuleMutations.createMutation.mutateAsync(controller.partitionRuleSection.formValues)
            }
            onCancel={controller.partitionRuleSection.clearSelection}
            isEditing={Boolean(controller.partitionRuleSection.selectedRecord)}
            isSubmitting={isSubmitting.partitionRule}
            successMessage={controller.partitionRuleMutations.feedback.successMessage}
            errorMessage={controller.partitionRuleMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Partition rules"
            subtitle="Partition B2B, dropship, or account-specific flows"
            rows={controller.partitionRules}
            columns={[
              { header: "Rule", key: "rule", render: (row) => row.name },
              { header: "Key", key: "key", render: (row) => row.partition_key },
              { header: "Value", key: "value", render: (row) => row.partition_value },
              { header: "Action", key: "action", render: (row) => row.handling_action },
              { header: "Edit", key: "edit", render: renderEditAction(controller.partitionRuleSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.partitionRulesQuery.isLoading}
            error={controller.partitionRulesQuery.error ? parseApiError(controller.partitionRulesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Remote Area Rules"
            description="Apply postal-code or city surcharges for remote destinations."
            fields={remoteAreaRuleFields}
            values={controller.remoteAreaRuleSection.formValues}
            onChange={controller.remoteAreaRuleSection.updateFormValue}
            onSubmit={() =>
              controller.remoteAreaRuleSection.selectedRecord
                ? controller.remoteAreaRuleMutations.updateMutation.mutateAsync(controller.remoteAreaRuleSection.formValues)
                : controller.remoteAreaRuleMutations.createMutation.mutateAsync(controller.remoteAreaRuleSection.formValues)
            }
            onCancel={controller.remoteAreaRuleSection.clearSelection}
            isEditing={Boolean(controller.remoteAreaRuleSection.selectedRecord)}
            isSubmitting={isSubmitting.remoteAreaRule}
            successMessage={controller.remoteAreaRuleMutations.feedback.successMessage}
            errorMessage={controller.remoteAreaRuleMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Remote area rules"
            subtitle="Destination-based remote-area surcharges"
            rows={controller.remoteAreaRules}
            columns={[
              { header: "Country", key: "country", render: (row) => row.country_code },
              { header: "Pattern", key: "pattern", render: (row) => row.postal_code_pattern },
              { header: "Surcharge", key: "surcharge", render: (row) => `${row.currency} ${row.surcharge_amount}` },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || anyLabel },
              { header: "Edit", key: "edit", render: renderEditAction(controller.remoteAreaRuleSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.remoteAreaRulesQuery.isLoading}
            error={controller.remoteAreaRulesQuery.error ? parseApiError(controller.remoteAreaRulesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Fuel Rules"
            description="Track effective fuel surcharge percentages by channel."
            fields={fuelRuleFields}
            values={controller.fuelRuleSection.formValues}
            onChange={controller.fuelRuleSection.updateFormValue}
            onSubmit={() =>
              controller.fuelRuleSection.selectedRecord
                ? controller.fuelRuleMutations.updateMutation.mutateAsync(controller.fuelRuleSection.formValues)
                : controller.fuelRuleMutations.createMutation.mutateAsync(controller.fuelRuleSection.formValues)
            }
            onCancel={controller.fuelRuleSection.clearSelection}
            isEditing={Boolean(controller.fuelRuleSection.selectedRecord)}
            isSubmitting={isSubmitting.fuelRule}
            successMessage={controller.fuelRuleMutations.feedback.successMessage}
            errorMessage={controller.fuelRuleMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Fuel rules"
            subtitle="Channel-specific fuel tables"
            rows={controller.fuelRules}
            columns={[
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || anyLabel },
              { header: "Effective from", key: "from", render: (row) => row.effective_from },
              { header: "Effective to", key: "to", render: (row) => row.effective_to || "--" },
              { header: "Fuel %", key: "percent", render: (row) => row.surcharge_percent },
              { header: "Edit", key: "edit", render: renderEditAction(controller.fuelRuleSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.fuelRulesQuery.isLoading}
            error={controller.fuelRulesQuery.error ? parseApiError(controller.fuelRulesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Waybill Watermark"
            description="Apply compliance or branding watermarks to waybills."
            fields={waybillWatermarkFields}
            values={controller.waybillWatermarkSection.formValues}
            onChange={controller.waybillWatermarkSection.updateFormValue}
            onSubmit={() =>
              controller.waybillWatermarkSection.selectedRecord
                ? controller.waybillWatermarkMutations.updateMutation.mutateAsync(controller.waybillWatermarkSection.formValues)
                : controller.waybillWatermarkMutations.createMutation.mutateAsync(controller.waybillWatermarkSection.formValues)
            }
            onCancel={controller.waybillWatermarkSection.clearSelection}
            isEditing={Boolean(controller.waybillWatermarkSection.selectedRecord)}
            isSubmitting={isSubmitting.watermark}
            successMessage={controller.waybillWatermarkMutations.feedback.successMessage}
            errorMessage={controller.waybillWatermarkMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Waybill watermarks"
            subtitle="Watermarks applied to online or offline labels"
            rows={controller.waybillWatermarks}
            columns={[
              { header: "Name", key: "name", render: (row) => row.name },
              { header: "Text", key: "text", render: (row) => row.watermark_text },
              { header: "Position", key: "position", render: (row) => row.position },
              { header: "Opacity", key: "opacity", render: (row) => `${row.opacity_percent}%` },
              { header: "Edit", key: "edit", render: renderEditAction(controller.waybillWatermarkSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.watermarksQuery.isLoading}
            error={controller.watermarksQuery.error ? parseApiError(controller.watermarksQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Charging Strategy"
            description="Define rating logic for order, parcel, weight-band, or value-based charges."
            fields={chargingStrategyFields}
            values={controller.chargingStrategySection.formValues}
            onChange={controller.chargingStrategySection.updateFormValue}
            onSubmit={() =>
              controller.chargingStrategySection.selectedRecord
                ? controller.chargingStrategyMutations.updateMutation.mutateAsync(controller.chargingStrategySection.formValues)
                : controller.chargingStrategyMutations.createMutation.mutateAsync(controller.chargingStrategySection.formValues)
            }
            onCancel={controller.chargingStrategySection.clearSelection}
            isEditing={Boolean(controller.chargingStrategySection.selectedRecord)}
            isSubmitting={isSubmitting.chargingStrategy}
            successMessage={controller.chargingStrategyMutations.feedback.successMessage}
            errorMessage={controller.chargingStrategyMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Charging strategies"
            subtitle="Core logistics charging strategies"
            rows={controller.chargingStrategies}
            columns={[
              { header: "Strategy", key: "strategy", render: (row) => row.name },
              { header: "Basis", key: "basis", render: (row) => row.charging_basis },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || "--" },
              { header: "Base fee", key: "base", render: (row) => `${row.currency} ${row.base_fee}` },
              { header: "Edit", key: "edit", render: renderEditAction(controller.chargingStrategySection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.chargingStrategiesQuery.isLoading}
            error={controller.chargingStrategiesQuery.error ? parseApiError(controller.chargingStrategiesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Special customer logistics charging"
            description="Override rate cards for key customers or negotiated channels."
            fields={specialCustomerChargingFields}
            values={controller.specialCustomerChargingSection.formValues}
            onChange={controller.specialCustomerChargingSection.updateFormValue}
            onSubmit={() =>
              controller.specialCustomerChargingSection.selectedRecord
                ? controller.specialCustomerChargingMutations.updateMutation.mutateAsync(controller.specialCustomerChargingSection.formValues)
                : controller.specialCustomerChargingMutations.createMutation.mutateAsync(controller.specialCustomerChargingSection.formValues)
            }
            onCancel={controller.specialCustomerChargingSection.clearSelection}
            isEditing={Boolean(controller.specialCustomerChargingSection.selectedRecord)}
            isSubmitting={isSubmitting.specialCustomer}
            successMessage={controller.specialCustomerChargingMutations.feedback.successMessage}
            errorMessage={controller.specialCustomerChargingMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Special customer charging"
            subtitle="Customer-specific logistics charging overrides"
            rows={controller.specialCustomerChargingRules}
            columns={[
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || "--" },
              { header: "Strategy", key: "strategy", render: (row) => row.charging_strategy_name || "--" },
              { header: "Base fee", key: "base", render: (row) => row.base_fee_override },
              { header: "Edit", key: "edit", render: renderEditAction(controller.specialCustomerChargingSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.specialCustomerChargingQuery.isLoading}
            error={controller.specialCustomerChargingQuery.error ? parseApiError(controller.specialCustomerChargingQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Charging"
            description="Capture operational logistics charges for review and invoicing."
            fields={logisticsChargeFields}
            values={controller.logisticsChargeSection.formValues}
            onChange={controller.logisticsChargeSection.updateFormValue}
            onSubmit={() =>
              controller.logisticsChargeSection.selectedRecord
                ? controller.logisticsChargeMutations.updateMutation.mutateAsync(controller.logisticsChargeSection.formValues)
                : controller.logisticsChargeMutations.createMutation.mutateAsync(controller.logisticsChargeSection.formValues)
            }
            onCancel={controller.logisticsChargeSection.clearSelection}
            isEditing={Boolean(controller.logisticsChargeSection.selectedRecord)}
            isSubmitting={isSubmitting.logisticsCharge}
            successMessage={controller.logisticsChargeMutations.feedback.successMessage}
            errorMessage={controller.logisticsChargeMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Logistics charges"
            subtitle="Customer-facing logistics charges"
            rows={controller.logisticsCharges}
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.source_reference },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || "--" },
              { header: "Status", key: "status", render: (row) => row.status },
              { header: "Total", key: "total", render: (row) => `${row.currency} ${row.total_amount}` },
              { header: "Edit", key: "edit", render: renderEditAction(controller.logisticsChargeSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.logisticsChargesQuery.isLoading}
            error={controller.logisticsChargesQuery.error ? parseApiError(controller.logisticsChargesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <LogisticsEditorCard
            title="Logistics Cost"
            description="Track landed carrier costs for reconciliation and margin review."
            fields={logisticsCostFields}
            values={controller.logisticsCostSection.formValues}
            onChange={controller.logisticsCostSection.updateFormValue}
            onSubmit={() =>
              controller.logisticsCostSection.selectedRecord
                ? controller.logisticsCostMutations.updateMutation.mutateAsync(controller.logisticsCostSection.formValues)
                : controller.logisticsCostMutations.createMutation.mutateAsync(controller.logisticsCostSection.formValues)
            }
            onCancel={controller.logisticsCostSection.clearSelection}
            isEditing={Boolean(controller.logisticsCostSection.selectedRecord)}
            isSubmitting={isSubmitting.logisticsCost}
            successMessage={controller.logisticsCostMutations.feedback.successMessage}
            errorMessage={controller.logisticsCostMutations.feedback.errorMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Logistics costs"
            subtitle="Carrier-side cost and reconciliation entries"
            rows={controller.logisticsCosts}
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.source_reference },
              { header: "Channel", key: "channel", render: (row) => row.provider_channel_name || "--" },
              { header: "Status", key: "status", render: (row) => row.status },
              { header: "Total", key: "total", render: (row) => `${row.currency} ${row.total_amount}` },
              { header: "Edit", key: "edit", render: renderEditAction(controller.logisticsCostSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.logisticsCostsQuery.isLoading}
            error={controller.logisticsCostsQuery.error ? parseApiError(controller.logisticsCostsQuery.error) : null}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
