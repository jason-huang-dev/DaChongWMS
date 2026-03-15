import { Button, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import type { ReturnOrderEditValues } from "@/features/returns/model/types";
import { DocumentHeaderFields } from "@/shared/components/document-header-fields";
import { MutationCard } from "@/shared/components/mutation-card";

interface ReturnOrderFormProps {
  form: UseFormReturn<ReturnOrderEditValues>;
  isArchiving: boolean;
  isSubmitting: boolean;
  canArchive: boolean;
  successMessage?: string | null;
  onArchive: () => void;
  onSubmit: (values: ReturnOrderEditValues) => void;
}

export function ReturnOrderForm({
  form,
  isArchiving,
  isSubmitting,
  canArchive,
  successMessage,
  onArchive,
  onSubmit,
}: ReturnOrderFormProps) {
  return (
    <MutationCard
      description="Header edits stay limited to the fields the returns API allows operators to change directly."
      successMessage={successMessage}
      title="Edit return order"
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
              {isArchiving ? "Archiving..." : "Archive return order"}
            </Button>
          </Stack>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
