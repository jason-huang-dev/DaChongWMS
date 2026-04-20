import { Alert, Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import type { InvoiceActionValues } from "@/features/reporting/model/types";
import { FormTextField } from "@/shared/components/form-text-field";

interface FinanceFormProps {
  form: UseFormReturn<InvoiceActionValues>;
  isSubmitting: boolean;
  canFinalize: boolean;
  canSubmitFinanceReview: boolean;
  canDecideFinanceReview: boolean;
  successMessage?: string | null;
  onFinalize: () => void;
  onSubmitFinanceReview: () => void;
  onApproveFinanceReview: () => void;
  onRejectFinanceReview: () => void;
}

export function FinanceForm({
  form,
  isSubmitting,
  canFinalize,
  canSubmitFinanceReview,
  canDecideFinanceReview,
  successMessage,
  onFinalize,
  onSubmitFinanceReview,
  onApproveFinanceReview,
  onRejectFinanceReview,
}: FinanceFormProps) {
  return (
    <FormProvider {...form}>
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12 }}>
            <FormTextField label="Action notes" multiline minRows={3} name="notes" />
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Button disabled={isSubmitting || !canFinalize} onClick={onFinalize} variant="contained">
            Finalize invoice
          </Button>
          <Button disabled={isSubmitting || !canSubmitFinanceReview} onClick={onSubmitFinanceReview} variant="outlined">
            Submit finance review
          </Button>
          <Button
            color="success"
            disabled={isSubmitting || !canDecideFinanceReview}
            onClick={onApproveFinanceReview}
            variant="outlined"
          >
            Approve review
          </Button>
          <Button
            color="error"
            disabled={isSubmitting || !canDecideFinanceReview}
            onClick={onRejectFinanceReview}
            variant="outlined"
          >
            Reject review
          </Button>
        </Stack>
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      </Stack>
    </FormProvider>
  );
}
