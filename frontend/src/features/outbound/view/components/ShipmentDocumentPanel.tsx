import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useShipmentDocumentController } from "@/features/outbound/controller/useOutboundController";
import type { ShipmentDocumentValues } from "@/features/outbound/model/types";
import { shipmentDocumentSchema } from "@/features/outbound/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import {
  useSalesOrderReferenceOptions,
  useShipmentReferenceOptions,
  useWarehouseReferenceOptions,
  useWaveReferenceOptions,
} from "@/shared/hooks/use-reference-options";

interface ShipmentDocumentPanelProps {
  documentType: ShipmentDocumentValues["document_type"];
  title: string;
  description: string;
  submitLabel: string;
}

export function ShipmentDocumentPanel({
  documentType,
  title,
  description,
  submitLabel,
}: ShipmentDocumentPanelProps) {
  const { mutation, successMessage, errorMessage } = useShipmentDocumentController();
  const form = useForm<ShipmentDocumentValues>({
    defaultValues: {
      warehouse: 0,
      sales_order: 0,
      shipment: undefined,
      wave: undefined,
      document_number: "",
      document_type: documentType,
      reference_code: "",
      file_name: "",
      notes: "",
    },
    resolver: zodResolver(shipmentDocumentSchema),
  });
  const selectedWarehouseId = form.watch("warehouse") || undefined;
  const warehouses = useWarehouseReferenceOptions();
  const salesOrders = useSalesOrderReferenceOptions(selectedWarehouseId);
  const shipments = useShipmentReferenceOptions(selectedWarehouseId);
  const waves = useWaveReferenceOptions(selectedWarehouseId);

  const handleSubmit = form.handleSubmit((values) =>
    mutation.mutate(values, {
      onSuccess: () =>
        form.reset({
          warehouse: 0,
          sales_order: 0,
          shipment: undefined,
          wave: undefined,
          document_number: "",
          document_type: documentType,
          reference_code: "",
          file_name: "",
          notes: "",
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
              <FormTextField label="Document number" name="document_number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormTextField label="Reference code" name="reference_code" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="File name" name="file_name" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" minRows={2} multiline name="notes" />
            </Grid>
          </Grid>
          <Button disabled={mutation.isPending} type="submit" variant="contained">
            {mutation.isPending ? "Generating..." : submitLabel}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
