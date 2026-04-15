import Grid from "@mui/material/Grid";

import { FormTextField } from "@/shared/components/form-text-field";

interface DocumentHeaderFieldsProps {
  dateLabel: string;
  dateName: string;
  dateInputType?: "date" | "datetime-local";
  notesLabel?: string;
  notesName?: string;
  referenceLabel?: string;
  referenceName?: string;
}

export function DocumentHeaderFields({
  dateLabel,
  dateName,
  dateInputType = "datetime-local",
  notesLabel = "Notes",
  notesName = "notes",
  referenceLabel = "Reference code",
  referenceName = "reference_code",
}: DocumentHeaderFieldsProps) {
  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, md: 4 }}>
        <FormTextField
          InputLabelProps={{ shrink: true }}
          label={dateLabel}
          name={dateName}
          type={dateInputType}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <FormTextField label={referenceLabel} name={referenceName} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <FormTextField label={notesLabel} minRows={3} multiline name={notesName} />
      </Grid>
    </Grid>
  );
}
