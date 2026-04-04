import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import CloseIcon from "@mui/icons-material/Close";
import Grid from "@mui/material/Grid";
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ClientAccountFormValues, ClientAccountRecord } from "@/features/clients/model/types";
import { clientAccountFormSchema } from "@/features/clients/model/validators";
import {
  clientLifecycleLabels,
  listClientContactPeople,
  resolveClientLifecycleStatus,
} from "@/features/clients/model/client-accounts";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { SummaryCard } from "@/shared/components/summary-card";
import { StatusChip } from "@/shared/components/status-chip";
import { formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { Button } from "@mui/material";

interface ClientAccountFormProps {
  open: boolean;
  client?: ClientAccountRecord | null;
  defaultValues: ClientAccountFormValues;
  errorMessage?: string | null;
  successMessage?: string | null;
  isEditing: boolean;
  isSubmitting: boolean;
  onSubmit: (values: ClientAccountFormValues) => Promise<unknown> | unknown;
  onClose: () => void;
}

export function ClientAccountForm({
  open,
  client,
  defaultValues,
  errorMessage,
  successMessage,
  isEditing,
  isSubmitting,
  onSubmit,
  onClose,
}: ClientAccountFormProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const form = useForm<ClientAccountFormValues>({
    defaultValues,
    resolver: zodResolver(clientAccountFormSchema),
    values: defaultValues,
  });

  useEffect(() => {
    if (open) {
      setActiveTab("basic");
    }
  }, [open, client?.id]);

  const contacts = client ? listClientContactPeople(client) : [];
  const lifecycleStatus = client ? resolveClientLifecycleStatus(client) : null;

  return (
    <Dialog fullWidth maxWidth="lg" onClose={onClose} open={open}>
      <FormProvider {...form}>
        <Box component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))}>
          <DialogTitle sx={{ pb: 1.5 }}>
            <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
              <Stack direction="row" spacing={1.5}>
                <Typography variant="h6">{isEditing ? "Edit client account" : "Create client account"}</Typography>
                {lifecycleStatus ? <StatusChip status={lifecycleStatus} /> : null}
              </Stack>
              <IconButton aria-label="Close client account dialog" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <Tabs onChange={(_event, nextValue) => setActiveTab(nextValue)} value={activeTab}>
                <Tab label="Basic data" value="basic" />
                <Tab label="Assignments and portal" value="assignments" />
              </Tabs>

              {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
              {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

              {activeTab === "basic" ? (
                <Stack spacing={2.5}>
                  <Alert severity="info">
                    Core create and update flows are wired today. The second tab stages warehouse assignments, charging templates, and OMS handoff details as the backend contract expands.
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Client code" name="code" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Client name" name="name" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        helperText="Read from the extended client master record when available"
                        fullWidth
                        label="Company name"
                        value={client?.company_name ?? client?.name ?? ""}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Contact name" name="contact_name" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Contact email" name="contact_email" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Contact phone" name="contact_phone" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label="Billing email" name="billing_email" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        fullWidth
                        label="Settlement currency"
                        value={client?.settlement_currency ?? "Pending backend support"}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        fullWidth
                        label="Distribution"
                        value={client?.distribution_mode ? formatStatusLabel(client.distribution_mode) : "Pending backend support"}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormTextField label="Default shipping method" name="shipping_method" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        disabled
                        fullWidth
                        label="Serial number management"
                        value={
                          client?.serial_number_management
                            ? formatStatusLabel(client.serial_number_management)
                            : "Pending backend support"
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormTextField label="Operational notes" minRows={4} multiline name="notes" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label="Allow dropshipping orders" name="allow_dropshipping_orders" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label="Allow inbound goods" name="allow_inbound_goods" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label="Client account active" name="is_active" />
                    </Grid>
                  </Grid>
                </Stack>
              ) : (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <SummaryCard
                      description="Assignment placeholders for the next backend slice."
                      items={[
                        {
                          label: "Warehouses",
                          value: client?.warehouse_assignments?.join(", ") || "Not assigned",
                        },
                        {
                          label: "Charging template",
                          value: client?.charging_template_name || "Not assigned",
                        },
                        {
                          label: "Settlement currency",
                          value: client?.settlement_currency || "Pending backend support",
                        },
                        {
                          label: "Distribution",
                          value: client?.distribution_mode ? formatStatusLabel(client.distribution_mode) : "Pending backend support",
                        },
                      ]}
                      title="Warehouse and charging"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <SummaryCard
                      description="Read-only finance and credit posture for the selected client."
                      items={[
                        { label: "Available balance", value: formatNumber(client?.total_available_balance ?? 0) },
                        { label: "Credit limit", value: formatNumber(client?.credit_limit ?? 0) },
                        { label: "Credit used", value: formatNumber(client?.credit_used ?? 0) },
                        { label: "Authorized qty", value: formatNumber(client?.authorized_order_quantity ?? 0) },
                      ]}
                      title="Finance posture"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <SummaryCard
                      description="Current portal-facing readiness."
                      items={[
                        { label: "Lifecycle", value: lifecycleStatus ? clientLifecycleLabels[lifecycleStatus] : "Draft" },
                        {
                          label: "Serial number management",
                          value: client?.serial_number_management
                            ? formatStatusLabel(client.serial_number_management)
                            : "Pending backend support",
                        },
                        {
                          label: "OMS login URL",
                          value: client?.oms_login_url || "Not issued",
                        },
                        {
                          label: "Limited document balance",
                          value: client?.limit_balance_documents ? "Enabled" : "Disabled",
                        },
                      ]}
                      title="Portal and OMS"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <SummaryCard
                      description="Current contact scope exposed on the account."
                      items={[
                        { label: "Primary contact", value: client?.contact_name || "Not assigned" },
                        {
                          label: "Additional contacts",
                          value: contacts.length > 1 ? `${contacts.length - 1}` : "0",
                        },
                        { label: "Billing email", value: client?.billing_email || "Not assigned" },
                        { label: "Country / region", value: client?.country_region || "Pending backend support" },
                      ]}
                      title="Contact scope"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">
                      The warehouse-assignment, charging-template, portal-token, and OMS-login panels are scaffolded here so the page layout is ready before the remaining backend endpoints land.
                    </Alert>
                  </Grid>
                </Grid>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button color="inherit" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save client account" : "Create client account"}
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  );
}
