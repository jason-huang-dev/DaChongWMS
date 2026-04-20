import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScanPickController } from "@/features/outbound/controller/useOutboundController";
import type { ScanPickValues } from "@/features/outbound/model/types";
import { scanPickSchema } from "@/features/outbound/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

const defaultValues: ScanPickValues = {
  task_number: "",
  from_location_barcode: "",
  goods_barcode: "",
  to_location_barcode: "",
  lpn_barcode: "",
};

export function ScanPickPanel() {
  const { mutation, successMessage, errorMessage } = useScanPickController();
  const form = useForm<ScanPickValues>({
    defaultValues,
    resolver: zodResolver(scanPickSchema),
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
      description="Confirm a pick by scanning the task, source bin, SKU, and staging location."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Scan pick"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Task number" name="task_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Goods barcode" name="goods_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="From-location barcode" name="from_location_barcode" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="To-location barcode" name="to_location_barcode" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="LPN barcode" name="lpn_barcode" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Completing pick..." : "Complete pick"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
