import { Alert, Grid, Button, Stack } from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useCarrierBookingDetailController } from "@/features/integrations/controller/useIntegrationsController";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";
import { JsonBlock } from "@/shared/components/json-block";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { RecordLink } from "@/shared/components/record-link";
import { RouteFallback } from "@/shared/components/route-fallback";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function CarrierBookingDetailPage() {
  const { carrierBookingId } = useParams<{ carrierBookingId: string }>();
  const { carrierBookingQuery, errorMessage, generateLabelMutation, successMessage } =
    useCarrierBookingDetailController(carrierBookingId);

  if (!carrierBookingId) {
    return <Navigate replace to="/integrations" />;
  }

  if (carrierBookingQuery.isLoading) {
    return <RouteFallback />;
  }

  const booking = carrierBookingQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={generateLabelMutation.isPending || booking?.status === "LABELED"}
              onClick={() => generateLabelMutation.mutate()}
              variant="contained"
            >
              {generateLabelMutation.isPending ? "Generating..." : "Generate label"}
            </Button>
            <Button component={RouterLink} to="/integrations" variant="outlined">
              Back to integrations
            </Button>
          </Stack>
        }
        description="Inspect carrier booking state, linked jobs, label output, and request/response payloads."
        title="Carrier booking detail"
      />
      <QueryAlert message={carrierBookingQuery.error ? parseApiError(carrierBookingQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!booking ? null : (
        <>
          <DetailCard description="Booking metadata, shipment linkage, and label state." title="Booking summary">
            <DetailGrid
              items={[
                { label: "Booking", value: booking.booking_number },
                { label: "Carrier", value: booking.carrier_code },
                { label: "Service level", value: booking.service_level || "--" },
                { label: "Status", value: <StatusChip status={booking.status} /> },
                { label: "Shipment", value: booking.shipment ?? "--" },
                { label: "Package count", value: booking.package_count },
                { label: "Total weight", value: booking.total_weight || "--" },
                { label: "Tracking", value: booking.tracking_number || "--" },
                { label: "Label format", value: booking.label_format || "--" },
                { label: "External reference", value: booking.external_reference || "--" },
                {
                  label: "Booking job",
                  value: booking.booking_job ? (
                    <RecordLink to={`/integrations/jobs/${booking.booking_job}`}>Job {booking.booking_job}</RecordLink>
                  ) : (
                    "--"
                  ),
                },
                {
                  label: "Label job",
                  value: booking.label_job ? (
                    <RecordLink to={`/integrations/jobs/${booking.label_job}`}>Job {booking.label_job}</RecordLink>
                  ) : (
                    "--"
                  ),
                },
                { label: "Booked by", value: booking.booked_by || "--" },
                { label: "Booked at", value: formatDateTime(booking.booked_at) },
                { label: "Labeled at", value: formatDateTime(booking.labeled_at) },
                { label: "Last error", value: booking.last_error || "--" },
              ]}
            />
          </DetailCard>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Carrier booking request payload sent to the backend." title="Request payload">
                <JsonBlock value={booking.request_payload} />
              </DetailCard>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Carrier booking response payload and label reference." title="Response payload">
                <Stack spacing={2}>
                  <JsonBlock value={booking.response_payload} />
                  <DetailGrid items={[{ label: "Label document", value: booking.label_document || "--" }]} />
                </Stack>
              </DetailCard>
            </Grid>
          </Grid>
        </>
      )}
    </Stack>
  );
}
