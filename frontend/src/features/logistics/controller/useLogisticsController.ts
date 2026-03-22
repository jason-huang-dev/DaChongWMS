import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import {
  buildChargingStrategyDetailPath,
  buildChargingStrategiesPath,
  buildCustomerLogisticsChannelDetailPath,
  buildCustomerLogisticsChannelsPath,
  buildFuelRuleDetailPath,
  buildFuelRulesPath,
  buildLogisticsChargeDetailPath,
  buildLogisticsChargesPath,
  buildLogisticsCostDetailPath,
  buildLogisticsCostsPath,
  buildLogisticsGroupDetailPath,
  buildLogisticsGroupsPath,
  buildLogisticsProviderChannelDetailPath,
  buildLogisticsProviderChannelsPath,
  buildLogisticsProviderDetailPath,
  buildLogisticsProvidersPath,
  buildLogisticsRuleDetailPath,
  buildLogisticsRulesPath,
  buildOrganizationWarehousesPath,
  buildPartitionRuleDetailPath,
  buildPartitionRulesPath,
  buildRemoteAreaRuleDetailPath,
  buildRemoteAreaRulesPath,
  buildSpecialCustomerChargingDetailPath,
  buildSpecialCustomerChargingPath,
  buildWaybillWatermarkDetailPath,
  buildWaybillWatermarksPath,
} from "@/features/logistics/model/api";
import {
  defaultCustomerLogisticsChannelFormValues,
  defaultFuelRuleFormValues,
  defaultLogisticsChargeFormValues,
  defaultLogisticsChargingStrategyFormValues,
  defaultLogisticsCostFormValues,
  defaultLogisticsGroupFormValues,
  defaultLogisticsProviderChannelFormValues,
  defaultLogisticsProviderFormValues,
  defaultLogisticsRuleFormValues,
  defaultPartitionRuleFormValues,
  defaultRemoteAreaRuleFormValues,
  defaultSpecialCustomerLogisticsChargingFormValues,
  defaultWaybillWatermarkFormValues,
  mapCustomerLogisticsChannelToFormValues,
  mapFuelRuleToFormValues,
  mapLogisticsChargeToFormValues,
  mapLogisticsChargingStrategyToFormValues,
  mapLogisticsCostToFormValues,
  mapLogisticsGroupToFormValues,
  mapLogisticsProviderChannelToFormValues,
  mapLogisticsProviderToFormValues,
  mapLogisticsRuleToFormValues,
  mapPartitionRuleToFormValues,
  mapRemoteAreaRuleToFormValues,
  mapSpecialCustomerLogisticsChargingToFormValues,
  mapWaybillWatermarkToFormValues,
} from "@/features/logistics/model/mappers";
import type {
  CustomerLogisticsChannelFormValues,
  CustomerLogisticsChannelRecord,
  FuelRuleFormValues,
  FuelRuleRecord,
  LogisticsChargeFormValues,
  LogisticsChargeRecord,
  LogisticsChargingStrategyFormValues,
  LogisticsChargingStrategyRecord,
  LogisticsCostFormValues,
  LogisticsCostRecord,
  LogisticsGroupFormValues,
  LogisticsGroupRecord,
  LogisticsProviderChannelFormValues,
  LogisticsProviderChannelRecord,
  LogisticsProviderFormValues,
  LogisticsProviderRecord,
  LogisticsRuleFormValues,
  LogisticsRuleRecord,
  PartitionRuleFormValues,
  PartitionRuleRecord,
  RemoteAreaRuleFormValues,
  RemoteAreaRuleRecord,
  SpecialCustomerLogisticsChargingFormValues,
  SpecialCustomerLogisticsChargingRecord,
  WaybillWatermarkFormValues,
  WaybillWatermarkRecord,
} from "@/features/logistics/model/types";
import { apiPatch, apiPost } from "@/lib/http";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface WarehouseOptionRecord {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  is_active: boolean;
}

interface FeedbackState {
  successMessage: string | null;
  errorMessage: string | null;
}

type LogisticsSectionValues<TFormValues> = {
  [K in keyof TFormValues]: string | boolean;
};

interface EditableSectionState<TRecord, TFormValues extends LogisticsSectionValues<TFormValues>> {
  selectedRecord: TRecord | null;
  setSelectedRecord: (record: TRecord | null) => void;
  formValues: TFormValues;
  updateFormValue: <TKey extends keyof TFormValues & string>(key: TKey, value: TFormValues[TKey]) => void;
  clearSelection: () => void;
}

function emptyFeedback(): FeedbackState {
  return { successMessage: null, errorMessage: null };
}

function normalizeNullableNumber(value: string) {
  return value ? Number(value) : null;
}

function useEditableSection<TRecord, TFormValues extends LogisticsSectionValues<TFormValues>>(
  defaultValues: TFormValues,
  mapRecordToFormValues: (record: TRecord) => TFormValues,
): EditableSectionState<TRecord, TFormValues> {
  const [selectedRecord, setSelectedRecord] = useState<TRecord | null>(null);
  const [formValues, setFormValues] = useState<TFormValues>(defaultValues);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : defaultValues);
  }, [defaultValues, mapRecordToFormValues, selectedRecord]);

  return {
    selectedRecord,
    setSelectedRecord,
    formValues,
    updateFormValue: (key, value) => {
      setFormValues((current) => ({ ...current, [key]: value }));
    },
    clearSelection: () => setSelectedRecord(null),
  };
}

interface SaveMutationOptions<TRecord extends { id: number }, TFormValues> {
  companyId: number | undefined;
  selectedRecord: TRecord | null;
  setSelectedRecord: (record: TRecord | null) => void;
  createPath: (companyId: number) => string;
  updatePath: (companyId: number, recordId: number) => string;
  mapToPayload: (values: TFormValues) => object;
  getSuccessLabel: (record: TRecord) => string;
  resourceLabel: string;
}

function useSectionMutations<TRecord extends { id: number }, TFormValues>({
  companyId,
  selectedRecord,
  setSelectedRecord,
  createPath,
  updatePath,
  mapToPayload,
  getSuccessLabel,
  resourceLabel,
}: SaveMutationOptions<TRecord, TFormValues>) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState>(emptyFeedback);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["logistics", companyId] });
  };

  const createMutation = useMutation({
    mutationFn: async (values: TFormValues) => {
      if (!companyId) {
        throw new Error("No active workspace selected");
      }
      return apiPost<TRecord>(createPath(companyId), mapToPayload(values));
    },
    onSuccess: async (record) => {
      setFeedback({ successMessage: `${resourceLabel} ${getSuccessLabel(record)} created.`, errorMessage: null });
      setSelectedRecord(record);
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TFormValues) => {
      if (!companyId || !selectedRecord) {
        throw new Error(`No ${resourceLabel.toLowerCase()} selected`);
      }
      return apiPatch<TRecord>(updatePath(companyId, selectedRecord.id), mapToPayload(values));
    },
    onSuccess: async (record) => {
      setFeedback({ successMessage: `${resourceLabel} ${getSuccessLabel(record)} updated.`, errorMessage: null });
      setSelectedRecord(record);
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  return { createMutation, updateMutation, feedback };
}

export function useLogisticsController() {
  const { company } = useTenantScope();
  const companyId =
    typeof company?.id === "number"
      ? company.id
      : typeof company?.id === "string" && company.id.length > 0
        ? Number(company.id)
        : undefined;

  const providersQuery = useResource<LogisticsProviderRecord[]>(
    ["logistics", companyId, "providers"],
    buildLogisticsProvidersPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const logisticsGroupsQuery = useResource<LogisticsGroupRecord[]>(
    ["logistics", companyId, "groups"],
    buildLogisticsGroupsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const providerChannelsQuery = useResource<LogisticsProviderChannelRecord[]>(
    ["logistics", companyId, "provider-channels"],
    buildLogisticsProviderChannelsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const customerAccountsQuery = useResource<ClientAccountRecord[]>(
    ["logistics", companyId, "customer-accounts"],
    buildClientAccountsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const warehousesQuery = useResource<WarehouseOptionRecord[]>(
    ["logistics", companyId, "warehouses"],
    buildOrganizationWarehousesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const customerChannelsQuery = useResource<CustomerLogisticsChannelRecord[]>(
    ["logistics", companyId, "customer-channels"],
    buildCustomerLogisticsChannelsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const logisticsRulesQuery = useResource<LogisticsRuleRecord[]>(
    ["logistics", companyId, "rules"],
    buildLogisticsRulesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const partitionRulesQuery = useResource<PartitionRuleRecord[]>(
    ["logistics", companyId, "partition-rules"],
    buildPartitionRulesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const remoteAreaRulesQuery = useResource<RemoteAreaRuleRecord[]>(
    ["logistics", companyId, "remote-area-rules"],
    buildRemoteAreaRulesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const fuelRulesQuery = useResource<FuelRuleRecord[]>(
    ["logistics", companyId, "fuel-rules"],
    buildFuelRulesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const watermarksQuery = useResource<WaybillWatermarkRecord[]>(
    ["logistics", companyId, "waybill-watermarks"],
    buildWaybillWatermarksPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const chargingStrategiesQuery = useResource<LogisticsChargingStrategyRecord[]>(
    ["logistics", companyId, "charging-strategies"],
    buildChargingStrategiesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const specialCustomerChargingQuery = useResource<SpecialCustomerLogisticsChargingRecord[]>(
    ["logistics", companyId, "special-customer-charging"],
    buildSpecialCustomerChargingPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const logisticsChargesQuery = useResource<LogisticsChargeRecord[]>(
    ["logistics", companyId, "charges"],
    buildLogisticsChargesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const logisticsCostsQuery = useResource<LogisticsCostRecord[]>(
    ["logistics", companyId, "costs"],
    buildLogisticsCostsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );

  const providerSection = useEditableSection(defaultLogisticsProviderFormValues, mapLogisticsProviderToFormValues);
  const groupSection = useEditableSection(defaultLogisticsGroupFormValues, mapLogisticsGroupToFormValues);
  const providerChannelSection = useEditableSection(
    defaultLogisticsProviderChannelFormValues,
    mapLogisticsProviderChannelToFormValues,
  );
  const customerChannelSection = useEditableSection(
    defaultCustomerLogisticsChannelFormValues,
    mapCustomerLogisticsChannelToFormValues,
  );
  const logisticsRuleSection = useEditableSection(defaultLogisticsRuleFormValues, mapLogisticsRuleToFormValues);
  const partitionRuleSection = useEditableSection(defaultPartitionRuleFormValues, mapPartitionRuleToFormValues);
  const remoteAreaRuleSection = useEditableSection(defaultRemoteAreaRuleFormValues, mapRemoteAreaRuleToFormValues);
  const fuelRuleSection = useEditableSection(defaultFuelRuleFormValues, mapFuelRuleToFormValues);
  const waybillWatermarkSection = useEditableSection(
    defaultWaybillWatermarkFormValues,
    mapWaybillWatermarkToFormValues,
  );
  const chargingStrategySection = useEditableSection(
    defaultLogisticsChargingStrategyFormValues,
    mapLogisticsChargingStrategyToFormValues,
  );
  const specialCustomerChargingSection = useEditableSection(
    defaultSpecialCustomerLogisticsChargingFormValues,
    mapSpecialCustomerLogisticsChargingToFormValues,
  );
  const logisticsChargeSection = useEditableSection(defaultLogisticsChargeFormValues, mapLogisticsChargeToFormValues);
  const logisticsCostSection = useEditableSection(defaultLogisticsCostFormValues, mapLogisticsCostToFormValues);

  const providerMutations = useSectionMutations({
    companyId,
    selectedRecord: providerSection.selectedRecord,
    setSelectedRecord: providerSection.setSelectedRecord,
    createPath: buildLogisticsProvidersPath,
    updatePath: buildLogisticsProviderDetailPath,
    mapToPayload: (values: LogisticsProviderFormValues) => values,
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Provider",
  });
  const groupMutations = useSectionMutations({
    companyId,
    selectedRecord: groupSection.selectedRecord,
    setSelectedRecord: groupSection.setSelectedRecord,
    createPath: buildLogisticsGroupsPath,
    updatePath: buildLogisticsGroupDetailPath,
    mapToPayload: (values: LogisticsGroupFormValues) => values,
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Logistics group",
  });
  const providerChannelMutations = useSectionMutations({
    companyId,
    selectedRecord: providerChannelSection.selectedRecord,
    setSelectedRecord: providerChannelSection.setSelectedRecord,
    createPath: buildLogisticsProviderChannelsPath,
    updatePath: buildLogisticsProviderChannelDetailPath,
    mapToPayload: (values: LogisticsProviderChannelFormValues) => ({
      provider: Number(values.provider),
      logistics_group: normalizeNullableNumber(values.logistics_group),
      code: values.code,
      name: values.name,
      channel_mode: values.channel_mode,
      transport_mode: values.transport_mode,
      service_level: values.service_level,
      billing_code: values.billing_code,
      supports_waybill: values.supports_waybill,
      supports_tracking: values.supports_tracking,
      supports_scanform: values.supports_scanform,
      supports_manifest: values.supports_manifest,
      supports_relabel: values.supports_relabel,
      is_default: values.is_default,
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Provider channel",
  });
  const customerChannelMutations = useSectionMutations({
    companyId,
    selectedRecord: customerChannelSection.selectedRecord,
    setSelectedRecord: customerChannelSection.setSelectedRecord,
    createPath: buildCustomerLogisticsChannelsPath,
    updatePath: buildCustomerLogisticsChannelDetailPath,
    mapToPayload: (values: CustomerLogisticsChannelFormValues) => ({
      customer_account: Number(values.customer_account),
      provider_channel: Number(values.provider_channel),
      client_channel_name: values.client_channel_name,
      external_account_number: values.external_account_number,
      priority: Number(values.priority),
      is_default: values.is_default,
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.provider_channel_code,
    resourceLabel: "Customer channel",
  });
  const logisticsRuleMutations = useSectionMutations({
    companyId,
    selectedRecord: logisticsRuleSection.selectedRecord,
    setSelectedRecord: logisticsRuleSection.setSelectedRecord,
    createPath: buildLogisticsRulesPath,
    updatePath: buildLogisticsRuleDetailPath,
    mapToPayload: (values: LogisticsRuleFormValues) => ({
      logistics_group: normalizeNullableNumber(values.logistics_group),
      provider_channel: normalizeNullableNumber(values.provider_channel),
      warehouse: normalizeNullableNumber(values.warehouse),
      name: values.name,
      rule_scope: values.rule_scope,
      destination_country: values.destination_country,
      destination_state: values.destination_state,
      shipping_method: values.shipping_method,
      min_weight_kg: values.min_weight_kg,
      max_weight_kg: values.max_weight_kg,
      min_order_value: values.min_order_value,
      max_order_value: values.max_order_value,
      priority: Number(values.priority),
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.name,
    resourceLabel: "Rule",
  });
  const partitionRuleMutations = useSectionMutations({
    companyId,
    selectedRecord: partitionRuleSection.selectedRecord,
    setSelectedRecord: partitionRuleSection.setSelectedRecord,
    createPath: buildPartitionRulesPath,
    updatePath: buildPartitionRuleDetailPath,
    mapToPayload: (values: PartitionRuleFormValues) => ({
      logistics_group: normalizeNullableNumber(values.logistics_group),
      provider_channel: normalizeNullableNumber(values.provider_channel),
      name: values.name,
      partition_key: values.partition_key,
      partition_value: values.partition_value,
      handling_action: values.handling_action,
      priority: Number(values.priority),
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.name,
    resourceLabel: "Partition rule",
  });
  const remoteAreaRuleMutations = useSectionMutations({
    companyId,
    selectedRecord: remoteAreaRuleSection.selectedRecord,
    setSelectedRecord: remoteAreaRuleSection.setSelectedRecord,
    createPath: buildRemoteAreaRulesPath,
    updatePath: buildRemoteAreaRuleDetailPath,
    mapToPayload: (values: RemoteAreaRuleFormValues) => ({
      provider_channel: normalizeNullableNumber(values.provider_channel),
      country_code: values.country_code,
      postal_code_pattern: values.postal_code_pattern,
      city_name: values.city_name,
      surcharge_amount: values.surcharge_amount,
      currency: values.currency,
      is_active: values.is_active,
    }),
    getSuccessLabel: (record) => `${record.country_code} ${record.postal_code_pattern}`,
    resourceLabel: "Remote area rule",
  });
  const fuelRuleMutations = useSectionMutations({
    companyId,
    selectedRecord: fuelRuleSection.selectedRecord,
    setSelectedRecord: fuelRuleSection.setSelectedRecord,
    createPath: buildFuelRulesPath,
    updatePath: buildFuelRuleDetailPath,
    mapToPayload: (values: FuelRuleFormValues) => ({
      provider_channel: normalizeNullableNumber(values.provider_channel),
      effective_from: values.effective_from,
      effective_to: values.effective_to || null,
      surcharge_percent: values.surcharge_percent,
      minimum_charge: values.minimum_charge,
      maximum_charge: values.maximum_charge,
      is_active: values.is_active,
    }),
    getSuccessLabel: (record) => record.effective_from,
    resourceLabel: "Fuel rule",
  });
  const waybillWatermarkMutations = useSectionMutations({
    companyId,
    selectedRecord: waybillWatermarkSection.selectedRecord,
    setSelectedRecord: waybillWatermarkSection.setSelectedRecord,
    createPath: buildWaybillWatermarksPath,
    updatePath: buildWaybillWatermarkDetailPath,
    mapToPayload: (values: WaybillWatermarkFormValues) => ({
      ...values,
      opacity_percent: Number(values.opacity_percent),
    }),
    getSuccessLabel: (record) => record.name,
    resourceLabel: "Waybill watermark",
  });
  const chargingStrategyMutations = useSectionMutations({
    companyId,
    selectedRecord: chargingStrategySection.selectedRecord,
    setSelectedRecord: chargingStrategySection.setSelectedRecord,
    createPath: buildChargingStrategiesPath,
    updatePath: buildChargingStrategyDetailPath,
    mapToPayload: (values: LogisticsChargingStrategyFormValues) => ({
      logistics_group: normalizeNullableNumber(values.logistics_group),
      provider_channel: normalizeNullableNumber(values.provider_channel),
      name: values.name,
      charging_basis: values.charging_basis,
      currency: values.currency,
      base_fee: values.base_fee,
      unit_fee: values.unit_fee,
      minimum_charge: values.minimum_charge,
      includes_fuel_rule: values.includes_fuel_rule,
      includes_remote_area_fee: values.includes_remote_area_fee,
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.name,
    resourceLabel: "Charging strategy",
  });
  const specialCustomerChargingMutations = useSectionMutations({
    companyId,
    selectedRecord: specialCustomerChargingSection.selectedRecord,
    setSelectedRecord: specialCustomerChargingSection.setSelectedRecord,
    createPath: buildSpecialCustomerChargingPath,
    updatePath: buildSpecialCustomerChargingDetailPath,
    mapToPayload: (values: SpecialCustomerLogisticsChargingFormValues) => ({
      customer_account: Number(values.customer_account),
      provider_channel: normalizeNullableNumber(values.provider_channel),
      charging_strategy: normalizeNullableNumber(values.charging_strategy),
      base_fee_override: values.base_fee_override,
      unit_fee_override: values.unit_fee_override,
      minimum_charge_override: values.minimum_charge_override,
      is_active: values.is_active,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.customer_account_name,
    resourceLabel: "Special customer charging",
  });
  const logisticsChargeMutations = useSectionMutations({
    companyId,
    selectedRecord: logisticsChargeSection.selectedRecord,
    setSelectedRecord: logisticsChargeSection.setSelectedRecord,
    createPath: buildLogisticsChargesPath,
    updatePath: buildLogisticsChargeDetailPath,
    mapToPayload: (values: LogisticsChargeFormValues) => ({
      customer_account: normalizeNullableNumber(values.customer_account),
      provider_channel: normalizeNullableNumber(values.provider_channel),
      charging_strategy: normalizeNullableNumber(values.charging_strategy),
      warehouse: normalizeNullableNumber(values.warehouse),
      source_reference: values.source_reference,
      billing_reference: values.billing_reference,
      status: values.status,
      currency: values.currency,
      base_amount: values.base_amount,
      fuel_amount: values.fuel_amount,
      remote_area_amount: values.remote_area_amount,
      surcharge_amount: values.surcharge_amount,
      charged_at: values.charged_at,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.source_reference,
    resourceLabel: "Logistics charge",
  });
  const logisticsCostMutations = useSectionMutations({
    companyId,
    selectedRecord: logisticsCostSection.selectedRecord,
    setSelectedRecord: logisticsCostSection.setSelectedRecord,
    createPath: buildLogisticsCostsPath,
    updatePath: buildLogisticsCostDetailPath,
    mapToPayload: (values: LogisticsCostFormValues) => ({
      provider_channel: normalizeNullableNumber(values.provider_channel),
      warehouse: normalizeNullableNumber(values.warehouse),
      source_reference: values.source_reference,
      cost_reference: values.cost_reference,
      status: values.status,
      currency: values.currency,
      linehaul_amount: values.linehaul_amount,
      fuel_amount: values.fuel_amount,
      remote_area_amount: values.remote_area_amount,
      other_amount: values.other_amount,
      incurred_at: values.incurred_at,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.source_reference,
    resourceLabel: "Logistics cost",
  });

  const providers = providersQuery.data ?? [];
  const logisticsGroups = logisticsGroupsQuery.data ?? [];
  const providerChannels = providerChannelsQuery.data ?? [];
  const customerAccounts = customerAccountsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const customerChannels = customerChannelsQuery.data ?? [];
  const logisticsRules = logisticsRulesQuery.data ?? [];
  const partitionRules = partitionRulesQuery.data ?? [];
  const remoteAreaRules = remoteAreaRulesQuery.data ?? [];
  const fuelRules = fuelRulesQuery.data ?? [];
  const waybillWatermarks = watermarksQuery.data ?? [];
  const chargingStrategies = chargingStrategiesQuery.data ?? [];
  const specialCustomerChargingRules = specialCustomerChargingQuery.data ?? [];
  const logisticsCharges = logisticsChargesQuery.data ?? [];
  const logisticsCosts = logisticsCostsQuery.data ?? [];

  return {
    company,
    providers,
    providersQuery,
    logisticsGroups,
    logisticsGroupsQuery,
    providerChannels,
    providerChannelsQuery,
    onlineChannels: providerChannels.filter((channel) => channel.channel_mode === "ONLINE"),
    offlineChannels: providerChannels.filter((channel) => channel.channel_mode === "OFFLINE"),
    customerAccounts,
    warehouses,
    customerChannels,
    customerChannelsQuery,
    logisticsRules,
    logisticsRulesQuery,
    partitionRules,
    partitionRulesQuery,
    remoteAreaRules,
    remoteAreaRulesQuery,
    fuelRules,
    fuelRulesQuery,
    waybillWatermarks,
    watermarksQuery,
    chargingStrategies,
    chargingStrategiesQuery,
    specialCustomerChargingRules,
    specialCustomerChargingQuery,
    logisticsCharges,
    logisticsChargesQuery,
    logisticsCosts,
    logisticsCostsQuery,
    summary: useMemo(
      () => ({
        onlineChannelCount: providerChannels.filter((channel) => channel.channel_mode === "ONLINE").length,
        offlineChannelCount: providerChannels.filter((channel) => channel.channel_mode === "OFFLINE").length,
        customerChannelCount: customerChannels.length,
        activeRuleCount:
          logisticsRules.filter((rule) => rule.is_active).length +
          partitionRules.filter((rule) => rule.is_active).length +
          remoteAreaRules.filter((rule) => rule.is_active).length +
          fuelRules.filter((rule) => rule.is_active).length,
        pendingChargeCount: logisticsCharges.filter((charge) => charge.status === "PENDING_REVIEW").length,
        postedCostCount: logisticsCosts.filter((cost) => cost.status === "POSTED").length,
      }),
      [customerChannels, fuelRules, logisticsCharges, logisticsCosts, logisticsRules, partitionRules, providerChannels, remoteAreaRules],
    ),
    providerSection,
    providerMutations,
    groupSection,
    groupMutations,
    providerChannelSection,
    providerChannelMutations,
    customerChannelSection,
    customerChannelMutations,
    logisticsRuleSection,
    logisticsRuleMutations,
    partitionRuleSection,
    partitionRuleMutations,
    remoteAreaRuleSection,
    remoteAreaRuleMutations,
    fuelRuleSection,
    fuelRuleMutations,
    waybillWatermarkSection,
    waybillWatermarkMutations,
    chargingStrategySection,
    chargingStrategyMutations,
    specialCustomerChargingSection,
    specialCustomerChargingMutations,
    logisticsChargeSection,
    logisticsChargeMutations,
    logisticsCostSection,
    logisticsCostMutations,
  };
}
