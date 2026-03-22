import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScanReceiveController } from "@/features/inbound/controller/useInboundController";
import { scanReceiveSchema } from "@/features/inbound/model/validators";
import type { ScanReceiveValues } from "@/features/inbound/model/types";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

const defaultValues: ScanReceiveValues = {
  purchase_order_number: "",
  asn_number: "",
  receipt_number: "",
  receipt_location_barcode: "",
  goods_barcode: "",
  lpn_barcode: "",
  attribute_scan: "",
  received_qty: 1,
  stock_status: "AVAILABLE",
  lot_number: "",
  serial_number: "",
  unit_cost: 0,
  reference_code: "",
  notes: "",
  order_type: "",
};

interface ScanReceivePanelProps {
  orderType?: string;
}

export function ScanReceivePanel({ orderType }: ScanReceivePanelProps) {
  const { mutation, successMessage, errorMessage } = useScanReceiveController();
  const form = useForm<ScanReceiveValues>({
    defaultValues: { ...defaultValues, order_type: orderType ?? "" },
    resolver: zodResolver(scanReceiveSchema),
  });

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () => {
        form.reset({ ...defaultValues, order_type: orderType ?? "" });
      },
    }),
  );

  return (
    <MutationCard
      description="Handheld-style receipt posting. Scan an ASN or PO, the receipt location, and the product barcode to create the receipt transaction directly against the backend workflow."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Scan receive"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Purchase order number" name="purchase_order_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="ASN number" name="asn_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Receipt number" name="receipt_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Receipt location barcode" name="receipt_location_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Goods barcode" name="goods_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="LPN barcode" name="lpn_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Received quantity" name="received_qty" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Stock status" name="stock_status" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Lot number" name="lot_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Serial number" name="serial_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Unit cost" name="unit_cost" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Attribute scan" name="attribute_scan" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" multiline minRows={2} name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Posting receipt..." : "Post scan receipt"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
