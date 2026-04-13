import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import { usePackageExecutionController } from "@/features/outbound/controller/useOutboundController";
import type { PackageExecutionValues } from "@/features/outbound/model/types";
import { packageExecutionSchema } from "@/features/outbound/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import {
  useSalesOrderReferenceOptions,
  useShipmentReferenceOptions,
  useWarehouseReferenceOptions,
  useWaveReferenceOptions,
} from "@/shared/hooks/use-reference-options";
import type { ReferenceOption } from "@/shared/types/options";

const executionStatusOptions: ReferenceOption<"SUCCESS" | "FLAGGED">[] = [
  { value: "SUCCESS", label: "Success", record: "SUCCESS" },
  { value: "FLAGGED", label: "Flagged", record: "FLAGGED" },
];

interface PackageExecutionPanelProps {
  title: string;
  description: string;
  submitLabel: string;
  stepType: PackageExecutionValues["step_type"];
  orderType?: string;
}

export function PackageExecutionPanel({
  title,
  description,
  submitLabel,
  stepType,
  orderType,
}: PackageExecutionPanelProps) {
  const { t, translate, msg } = useI18n();
  const { mutation, successMessage, errorMessage } = usePackageExecutionController();
  const form = useForm<PackageExecutionValues>({
    defaultValues: {
      warehouse: 0,
      sales_order: 0,
      shipment: undefined,
      wave: undefined,
      record_number: "",
      step_type: stepType,
      execution_status: "SUCCESS",
      package_number: "",
      scan_code: "",
      weight: undefined,
      notes: "",
      requested_order_type: orderType ?? "",
    },
    resolver: zodResolver(packageExecutionSchema),
  });
  const selectedWarehouseId = form.watch("warehouse") || undefined;
  const warehouses = useWarehouseReferenceOptions();
  const salesOrders = useSalesOrderReferenceOptions(selectedWarehouseId, orderType);
  const shipments = useShipmentReferenceOptions(selectedWarehouseId, orderType);
  const waves = useWaveReferenceOptions(selectedWarehouseId, orderType);

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () =>
        form.reset({
          warehouse: 0,
          sales_order: 0,
          shipment: undefined,
          wave: undefined,
          record_number: "",
          step_type: stepType,
          execution_status: "SUCCESS",
          package_number: "",
          scan_code: "",
          weight: undefined,
          notes: "",
          requested_order_type: orderType ?? "",
        }),
    }),
  );

  return (
    <MutationCard description={description} errorMessage={errorMessage} successMessage={successMessage} title={title}>
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouses} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceAutocompleteField label="Sales order" name="sales_order" reference={salesOrders} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceAutocompleteField emptyText="No shipments" label="Shipment" name="shipment" reference={shipments} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReferenceAutocompleteField emptyText="No waves" label="Wave" name="wave" reference={waves} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Record number" name="record_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Package number" name="package_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Scan code" name="scan_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormAutocomplete label="Execution status" name="execution_status" options={executionStatusOptions} />
            </Grid>
            {stepType === "WEIGH" ? (
              <Grid size={{ xs: 12, md: 6 }}>
                <FormTextField label="Weight" name="weight" type="number" />
              </Grid>
            ) : null}
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" minRows={2} multiline name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? t("Submitting...") : translate(submitLabel)}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
