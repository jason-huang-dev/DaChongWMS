import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScanPutawayController } from "@/features/inbound/controller/useInboundController";
import { scanPutawaySchema } from "@/features/inbound/model/validators";
import type { ScanPutawayValues } from "@/features/inbound/model/types";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

const defaultValues: ScanPutawayValues = {
  task_number: "",
  from_location_barcode: "",
  to_location_barcode: "",
  goods_barcode: "",
  lpn_barcode: "",
  order_type: "",
};

interface ScanPutawayPanelProps {
  orderType?: string;
}

export function ScanPutawayPanel({ orderType }: ScanPutawayPanelProps) {
  const { mutation, successMessage, errorMessage } = useScanPutawayController();
  const form = useForm<ScanPutawayValues>({
    defaultValues: { ...defaultValues, order_type: orderType ?? "" },
    resolver: zodResolver(scanPutawaySchema),
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
      description="Close a putaway task by scanning the task number, source location, target location, and SKU barcode."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Scan putaway"
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
            {mutation.isPending ? "Completing putaway..." : "Complete putaway"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
