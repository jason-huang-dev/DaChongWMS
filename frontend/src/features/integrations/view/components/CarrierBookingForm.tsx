import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import type { CarrierBookingCreateValues } from "@/features/integrations/model/types";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormTextField } from "@/shared/components/form-text-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import { MutationCard } from "@/shared/components/mutation-card";
import type { ShipmentRecord, WarehouseRecord } from "@/shared/types/domain";

interface CarrierBookingFormProps {
  form: UseFormReturn<CarrierBookingCreateValues>;
  isPending: boolean;
  onSubmit: (values: CarrierBookingCreateValues) => void;
  shipmentReference: ReferenceListState<number, ShipmentRecord>;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
}

export function CarrierBookingForm({
  form,
  isPending,
  onSubmit,
  shipmentReference,
  warehouseReference,
}: CarrierBookingFormProps) {
  return (
    <MutationCard
      description="Create carrier bookings from shipment selectors and generate labels from the resulting booking records."
      title="Create carrier booking"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouseReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Shipment" name="shipment" reference={shipmentReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Booking number" name="booking_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Carrier code" name="carrier_code" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Service level" name="service_level" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Package count" name="package_count" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Total weight" name="total_weight" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="External reference" name="external_reference" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Request payload JSON" multiline minRows={4} name="request_payload_json" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create carrier booking"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
