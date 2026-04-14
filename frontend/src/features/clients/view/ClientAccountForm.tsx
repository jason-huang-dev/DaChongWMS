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

import { useI18n } from "@/app/ui-preferences";
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
  const { t, translate } = useI18n();
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
                <Typography variant="h6">{isEditing ? t("Edit client account") : t("Create client account")}</Typography>
                {lifecycleStatus ? <StatusChip status={lifecycleStatus} /> : null}
              </Stack>
              <IconButton aria-label={t("Close client account dialog")} onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <Tabs onChange={(_event, nextValue) => setActiveTab(nextValue)} value={activeTab}>
                <Tab label={t("Basic data")} value="basic" />
                <Tab label={t("Assignments and portal")} value="assignments" />
              </Tabs>

              {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
              {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

              {activeTab === "basic" ? (
                <Stack spacing={2.5}>
                  <Alert severity="info">
                    {t(
                      "Core create and update flows are wired today. The second tab stages warehouse assignments, charging templates, and portal access details as the backend contract expands.",
                    )}
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Client code")} name="code" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Client name")} name="name" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        helperText={t("Read from the extended client master record when available")}
                        fullWidth
                        label={t("Company name")}
                        value={client?.company_name ?? client?.name ?? ""}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Contact name")} name="contact_name" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Contact email")} name="contact_email" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Contact phone")} name="contact_phone" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormTextField label={t("Billing email")} name="billing_email" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        fullWidth
                        label={t("Settlement currency")}
                        value={client?.settlement_currency ?? t("Pending backend support")}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        disabled
                        fullWidth
                        label={t("Distribution")}
                        value={client?.distribution_mode ? translate(formatStatusLabel(client.distribution_mode)) : t("Pending backend support")}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormTextField label={t("Default shipping method")} name="shipping_method" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        disabled
                        fullWidth
                        label={t("Serial number management")}
                        value={
                          client?.serial_number_management
                            ? translate(formatStatusLabel(client.serial_number_management))
                            : t("Pending backend support")
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <FormTextField label={t("Operational notes")} minRows={4} multiline name="notes" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label={t("Allow dropshipping orders")} name="allow_dropshipping_orders" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label={t("Allow inbound goods")} name="allow_inbound_goods" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormSwitchField label={t("Client account active")} name="is_active" />
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
                          value: client?.warehouse_assignments?.join(", ") || t("Not assigned"),
                        },
                        {
                          label: "Charging template",
                          value: client?.charging_template_name || t("Not assigned"),
                        },
                        {
                          label: "Settlement currency",
                          value: client?.settlement_currency || t("Pending backend support"),
                        },
                        {
                          label: "Distribution",
                          value: client?.distribution_mode ? translate(formatStatusLabel(client.distribution_mode)) : t("Pending backend support"),
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
                        { label: "Lifecycle", value: lifecycleStatus ? translate(clientLifecycleLabels[lifecycleStatus]) : t("Draft") },
                        {
                          label: "Serial number management",
                          value: client?.serial_number_management
                            ? translate(formatStatusLabel(client.serial_number_management))
                            : t("Pending backend support"),
                        },
                        {
                          label: "Limited document balance",
                          value: client?.limit_balance_documents ? t("Enabled") : t("Disabled"),
                        },
                      ]}
                      title="Portal readiness"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <SummaryCard
                      description="Current contact scope exposed on the account."
                      items={[
                        { label: "Primary contact", value: client?.contact_name || t("Not assigned") },
                        {
                          label: "Additional contacts",
                          value: contacts.length > 1 ? `${contacts.length - 1}` : "0",
                        },
                        { label: "Billing email", value: client?.billing_email || t("Not assigned") },
                        { label: "Country / region", value: client?.country_region || t("Pending backend support") },
                      ]}
                      title="Contact scope"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">
                      {t(
                        "The warehouse-assignment, charging-template, and portal-token panels are scaffolded here so the page layout is ready before the remaining backend endpoints land.",
                      )}
                    </Alert>
                  </Grid>
                </Grid>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button color="inherit" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? t("Saving...") : isEditing ? t("Save client account") : t("Create client account")}
            </Button>
          </DialogActions>
        </Box>
      </FormProvider>
    </Dialog>
  );
}
