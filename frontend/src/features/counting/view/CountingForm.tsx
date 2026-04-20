import { Alert, Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import type { ApprovalDecisionValues } from "@/features/counting/model/types";
import { FormTextField } from "@/shared/components/form-text-field";

interface CountingFormProps {
  form: UseFormReturn<ApprovalDecisionValues>;
  canDecide: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  onApprove: () => void;
  onReject: () => void;
}

export function CountingForm({
  form,
  canDecide,
  isSubmitting,
  successMessage,
  onApprove,
  onReject,
}: CountingFormProps) {
  return (
    <FormProvider {...form}>
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12 }}>
            <FormTextField label="Decision notes" multiline minRows={3} name="notes" />
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button disabled={isSubmitting || !canDecide} onClick={onApprove} variant="contained">
            {isSubmitting ? "Submitting..." : "Approve variance"}
          </Button>
          <Button color="error" disabled={isSubmitting || !canDecide} onClick={onReject} variant="outlined">
            Reject variance
          </Button>
        </Stack>
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      </Stack>
    </FormProvider>
  );
}
