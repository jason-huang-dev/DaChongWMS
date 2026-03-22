import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScanSignController } from "@/features/inbound/controller/useInboundController";
import type { ScanSignValues } from "@/features/inbound/model/types";
import { scanSignSchema } from "@/features/inbound/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

const defaultValues: ScanSignValues = {
  purchase_order_number: "",
  asn_number: "",
  signing_number: "",
  carrier_name: "",
  vehicle_plate: "",
  reference_code: "",
  notes: "",
  order_type: "",
};

interface ScanSignPanelProps {
  orderType?: string;
}

export function ScanSignPanel({ orderType }: ScanSignPanelProps) {
  const { mutation, successMessage, errorMessage } = useScanSignController();
  const form = useForm<ScanSignValues>({
    defaultValues: { ...defaultValues, order_type: orderType ?? "" },
    resolver: zodResolver(scanSignSchema),
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
      description="Scan an ASN or purchase order when the truck arrives to log dock sign-off before warehouse receiving starts."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Scan sign"
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
              <FormTextField label="Signing number" name="signing_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Carrier name" name="carrier_name" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Vehicle plate" name="vehicle_plate" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" multiline minRows={2} name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Capturing sign-off..." : "Capture sign-off"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
