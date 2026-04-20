import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScanShipController } from "@/features/outbound/controller/useOutboundController";
import type { ScanShipValues } from "@/features/outbound/model/types";
import { scanShipSchema } from "@/features/outbound/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

const defaultValues: ScanShipValues = {
  sales_order_number: "",
  shipment_number: "",
  staging_location_barcode: "",
  goods_barcode: "",
  dock_location_barcode: "",
  lpn_barcode: "",
  attribute_scan: "",
  shipped_qty: 1,
  stock_status: "AVAILABLE",
  lot_number: "",
  serial_number: "",
  reference_code: "",
  notes: "",
  trailer_reference: "",
};

export function ScanShipPanel() {
  const { mutation, successMessage, errorMessage } = useScanShipController();
  const form = useForm<ScanShipValues>({
    defaultValues,
    resolver: zodResolver(scanShipSchema),
  });

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => {
        form.reset(defaultValues);
      },
    }),
  );

  return (
    <MutationCard
      description="Confirm dock loading and shipment by scanning the sales order, shipment number, stage location, and SKU barcode."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Scan ship"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Sales order number" name="sales_order_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Shipment number" name="shipment_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Staging location barcode" name="staging_location_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Goods barcode" name="goods_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Shipped quantity" name="shipped_qty" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Stock status" name="stock_status" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Dock location barcode" name="dock_location_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="LPN barcode" name="lpn_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Lot number" name="lot_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Serial number" name="serial_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Attribute scan" name="attribute_scan" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Trailer reference" name="trailer_reference" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" multiline minRows={2} name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Posting shipment..." : "Post shipment"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
