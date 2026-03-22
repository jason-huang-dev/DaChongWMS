import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useTrackingEventController } from "@/features/outbound/controller/useOutboundController";
import type { LogisticsTrackingValues } from "@/features/outbound/model/types";
import { logisticsTrackingSchema } from "@/features/outbound/model/validators";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import {
  useSalesOrderReferenceOptions,
  useShipmentReferenceOptions,
  useWarehouseReferenceOptions,
} from "@/shared/hooks/use-reference-options";
import type { ReferenceOption } from "@/shared/types/options";

const trackingStatusOptions: ReferenceOption<LogisticsTrackingValues["event_status"]>[] = [
  { value: "INFO_RECEIVED", label: "Info received", record: "INFO_RECEIVED" },
  { value: "IN_TRANSIT", label: "In transit", record: "IN_TRANSIT" },
  { value: "ARRIVED", label: "Arrived", record: "ARRIVED" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery", record: "OUT_FOR_DELIVERY" },
  { value: "DELIVERED", label: "Delivered", record: "DELIVERED" },
  { value: "EXCEPTION", label: "Exception", record: "EXCEPTION" },
];

const defaultValues: LogisticsTrackingValues = {
  warehouse: 0,
  sales_order: 0,
  shipment: undefined,
  event_number: "",
  tracking_number: "",
  event_code: "",
  event_status: "IN_TRANSIT",
  event_location: "",
  description: "",
};

export function TrackLogisticsPanel() {
  const { mutation, successMessage, errorMessage } = useTrackingEventController();
  const form = useForm<LogisticsTrackingValues>({
    defaultValues,
    resolver: zodResolver(logisticsTrackingSchema),
  });
  const selectedWarehouseId = form.watch("warehouse") || undefined;
  const warehouses = useWarehouseReferenceOptions();
  const salesOrders = useSalesOrderReferenceOptions(selectedWarehouseId);
  const shipments = useShipmentReferenceOptions(selectedWarehouseId);

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => form.reset(defaultValues),
    }),
  );

  return (
    <MutationCard
      description="Capture logistics tracking milestones so warehouse staff can monitor shipment movement after handover."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Logistics tracking"
    >
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
              <FormTextField label="Tracking number" name="tracking_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Event number" name="event_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Event code" name="event_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormAutocomplete label="Event status" name="event_status" options={trackingStatusOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Event location" name="event_location" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Description" minRows={2} multiline name="description" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Recording..." : "Record tracking event"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
