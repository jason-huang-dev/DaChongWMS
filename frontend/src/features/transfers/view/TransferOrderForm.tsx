import { Button, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import type { TransferOrderEditValues } from "@/features/transfers/model/types";
import { DocumentHeaderFields } from "@/shared/components/document-header-fields";
import { MutationCard } from "@/shared/components/mutation-card";

interface TransferOrderFormProps {
  form: UseFormReturn<TransferOrderEditValues>;
  isArchiving: boolean;
  isSubmitting: boolean;
  canArchive: boolean;
  successMessage?: string | null;
  onArchive: () => void;
  onSubmit: (values: TransferOrderEditValues) => void;
}

export function TransferOrderForm({
  form,
  isArchiving,
  isSubmitting,
  canArchive,
  successMessage,
  onArchive,
  onSubmit,
}: TransferOrderFormProps) {
  return (
    <MutationCard
      description="Header edits stay limited to fields the backend allows directly on the transfer order."
      successMessage={successMessage}
      title="Edit transfer order"
    >
      <FormProvider {...form}>
        <Stack
          component="form"
          noValidate
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
          spacing={2}
        >
          <DocumentHeaderFields dateLabel="Requested date" dateName="requested_date" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
            <Button
              color="error"
              disabled={isArchiving || !canArchive}
              onClick={onArchive}
              type="button"
              variant="outlined"
            >
              {isArchiving ? "Archiving..." : "Archive transfer order"}
            </Button>
          </Stack>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
