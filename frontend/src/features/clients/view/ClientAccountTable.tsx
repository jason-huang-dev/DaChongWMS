import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import type { ClientWorkbenchFilters } from "@/features/clients/controller/useClientsController";
import {
  clientLifecycleLabels,
  clientLifecycleOrder,
  downloadClientAccountsCsv,
  listClientContactPeople,
} from "@/features/clients/model/client-accounts";
import type { ClientAccountRecord, ClientLifecycleStatus } from "@/features/clients/model/types";
import { ClientAccountFilters } from "@/features/clients/view/components/ClientAccountFilters";
import { ClientAccountRowActions } from "@/features/clients/view/components/ClientAccountRowActions";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { DataTable, type DataTableRowSelection } from "@/shared/components/data-table";
import { FilterCard } from "@/shared/components/filter-card";
import { PageTabs } from "@/shared/components/page-tabs";
import { useCollapsibleTablePageChrome } from "@/shared/hooks/use-collapsible-table-page-chrome";
import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

interface ClientAccountTableProps {
  clients: ClientAccountRecord[];
  exportRows: ClientAccountRecord[];
  total: number;
  isLoading: boolean;
  isWorkspaceReady: boolean;
  error?: string | null;
  dataView: UseDataViewResult<ClientWorkbenchFilters>;
  lifecycleBucket: ClientLifecycleStatus;
  lifecycleCounts: Record<ClientLifecycleStatus, number>;
  rowSelection: DataTableRowSelection<ClientAccountRecord>;
  selectedCount: number;
  selectedClients: ClientAccountRecord[];
  onClearSelection: () => void;
  onBulkDeactivate: () => Promise<void> | void;
  onBulkReactivate: () => Promise<void> | void;
  onLifecycleBucketChange: (nextBucket: ClientLifecycleStatus) => void;
  onOpenBatchAssign: () => void;
  onResetFilters: () => void;
  onOpenCreate: () => void;
  onOpenDistributionPermissions: () => void;
  onEdit: (client: ClientAccountRecord) => void;
  onToggleActive: (client: ClientAccountRecord, nextActive: boolean) => Promise<void> | void;
  onOpenPortalAccess: (client: ClientAccountRecord) => void;
  onResetPassword: (client: ClientAccountRecord) => void;
  onObtainToken: (client: ClientAccountRecord) => void;
}

interface ClientFieldRow {
  label: string;
  value: string;
  emphasize?: boolean;
  wrap?: boolean;
}

const clientTableFieldFontSize = "0.75rem";
const clientTableFieldLineHeight = 1.35;

function renderFieldStack(items: ClientFieldRow[]) {
  return (
    <Stack spacing={0.45}>
      {items.map((item) => (
        <Stack direction="row" key={`${item.label}-${item.value}`} spacing={0.8} sx={{ minWidth: 0 }}>
          <Typography
            color="text.secondary"
            sx={{
              flex: "0 0 auto",
              fontSize: clientTableFieldFontSize,
              fontWeight: 600,
              lineHeight: clientTableFieldLineHeight,
            }}
            variant="caption"
          >
            {item.label}
          </Typography>
          <Typography
            sx={{
              fontSize: clientTableFieldFontSize,
              fontWeight: item.emphasize ? 700 : 500,
              lineHeight: clientTableFieldLineHeight,
              minWidth: 0,
              overflow: item.wrap ? "visible" : "hidden",
              textOverflow: item.wrap ? "clip" : "ellipsis",
              whiteSpace: item.wrap ? "normal" : "nowrap",
            }}
            variant="body2"
          >
            {item.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function resolveClientCode(row: ClientAccountRecord) {
  return row.code?.trim() || String(row.id);
}

function resolveClientName(row: ClientAccountRecord) {
  return row.name?.trim() || "--";
}

function resolveClientCompanyName(row: ClientAccountRecord) {
  return row.company_name?.trim() || resolveClientName(row);
}

function resolveClientSettlementCurrency(row: ClientAccountRecord) {
  return row.settlement_currency?.trim() || "";
}

function formatClientFinanceValue(value: number | null | undefined, currency: string) {
  const formattedNumber = formatNumber(value ?? 0);
  return currency ? `${currency} ${formattedNumber}` : formattedNumber;
}

function buildClientPermissionCode(row: ClientAccountRecord) {
  return [
    row.allow_inbound_goods ? "R" : "-",
    row.allow_dropshipping_orders ? "W" : "-",
    row.limit_balance_documents ? "X" : "-",
  ].join("");
}

function renderClientCodeNameCell(row: ClientAccountRecord) {
  const clientCode = resolveClientCode(row);
  const clientName = resolveClientName(row);

  return (
    <Stack spacing={0.75}>
      <Typography fontWeight={700} variant="body2">
        {clientCode}
      </Typography>
      <Typography color="text.secondary" sx={{ letterSpacing: 0.18 }} variant="caption">
        {clientName}
      </Typography>
    </Stack>
  );
}

function renderClientInformationCell(row: ClientAccountRecord) {
  const companyName = resolveClientCompanyName(row);
  const contactEmail = row.contact_email?.trim() || "--";
  const contactPhone = row.contact_phone?.trim() || "--";

  return renderFieldStack([
    { label: "Company Name", value: companyName, wrap: true },
    { label: "Email", value: contactEmail, wrap: true },
    { label: "Phone", value: contactPhone },
  ]);
}

function renderClientContactPersonCell(row: ClientAccountRecord) {
  const contacts = listClientContactPeople(row);
  const contactName = row.contact_name?.trim() || contacts[0]?.name?.trim() || "--";

  return renderFieldStack([
    { label: "Name", value: contactName, wrap: true },
  ]);
}

function renderClientFinanceCell(row: ClientAccountRecord) {
  const settlementCurrency = resolveClientSettlementCurrency(row);

  return renderFieldStack([
    { label: "Currency", value: settlementCurrency || "--" },
    { label: "Available Balance", value: formatClientFinanceValue(row.total_available_balance, settlementCurrency), emphasize: true },
    {
      label: "Credit",
      value: `${formatClientFinanceValue(row.credit_limit, settlementCurrency)} / ${formatClientFinanceValue(row.credit_used, settlementCurrency)}`,
    },
    { label: "Authorized Qty", value: formatNumber(row.authorized_order_quantity ?? 0) },
    { label: "Limit Balance", value: row.limit_balance_documents ? "Enabled" : "Disabled" },
  ]);
}

function renderClientSetupCell(row: ClientAccountRecord) {
  return renderFieldStack([
    { label: "Charging Template", value: row.charging_template_name || "Not assigned", wrap: true },
    { label: "Permissions", value: buildClientPermissionCode(row) },
  ]);
}

function renderClientTimeCell(row: ClientAccountRecord) {
  return renderFieldStack([
    { label: "Create", value: formatDateTime(row.create_time) },
    { label: "Update", value: formatDateTime(row.update_time) },
  ]);
}

export function ClientAccountTable({
  clients,
  exportRows,
  total,
  isLoading,
  isWorkspaceReady,
  error,
  dataView,
  lifecycleBucket,
  lifecycleCounts,
  rowSelection,
  selectedCount,
  selectedClients,
  onClearSelection,
  onBulkDeactivate,
  onBulkReactivate,
  onLifecycleBucketChange,
  onOpenBatchAssign,
  onResetFilters,
  onOpenCreate,
  onOpenDistributionPermissions,
  onEdit,
  onToggleActive,
  onOpenPortalAccess,
  onResetPassword,
  onObtainToken,
}: ClientAccountTableProps) {
  const hasActiveSelection = selectedClients.some((client) => client.is_active);
  const hasInactiveSelection = selectedClients.some((client) => !client.is_active);
  const hasFilterOverrides = Boolean(
    dataView.filters.customerQuery ||
      dataView.filters.companyQuery ||
      dataView.filters.financeMin ||
      dataView.filters.financeMax ||
      dataView.filters.setupQuery ||
      dataView.filters.timeStart ||
      dataView.filters.timeEnd,
  );
  const { t } = useI18n();
  const pageChrome = useCollapsibleTablePageChrome();
  const tableToolbar = (
    <Stack
      alignItems={{ xs: "stretch", lg: "center" }}
      direction={{ xs: "column", lg: "row" }}
      justifyContent="space-between"
      spacing={1}
      sx={{ minWidth: 0 }}
    >
      <Stack
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        spacing={0.5}
        sx={{ flex: "1 1 auto", minWidth: 0 }}
      >
        <Chip
          color={selectedCount > 0 ? "primary" : "default"}
          label={t("bulk.selectedCount", { count: selectedCount })}
          size="small"
          sx={{ alignSelf: { xs: "flex-start", md: "center" }, flex: "0 0 auto" }}
        />
        {selectedCount > 0 ? (
          <Stack
            sx={(theme) => ({
              flex: "0 1 auto",
              minWidth: 0,
              "& .MuiButton-root": {
                fontSize: theme.typography.pxToRem(12),
                minHeight: 28,
                px: 1,
              },
              "& .MuiChip-label": {
                fontSize: theme.typography.pxToRem(10.5),
              },
              "& .MuiTypography-body2": {
                fontSize: theme.typography.pxToRem(12),
              },
            })}
          >
            <Stack
              alignItems={{ xs: "stretch", md: "center" }}
              direction={{ xs: "column", md: "row" }}
              spacing={0.5}
            >
              <Button color="inherit" onClick={onClearSelection} size="small">
                Clear selection
              </Button>
              <Button
                color="inherit"
                disabled={!hasActiveSelection}
                onClick={onBulkDeactivate}
                size="small"
                variant="outlined"
              >
                Deactivate selected
              </Button>
              <Button
                disabled={!hasInactiveSelection}
                onClick={onBulkReactivate}
                size="small"
                variant="outlined"
              >
                Reactivate selected
              </Button>
              <Button
                onClick={() => downloadClientAccountsCsv(selectedClients, "client-accounts-selected")}
                size="small"
                variant="contained"
              >
                Export selected
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
      <Stack
        alignItems="center"
        direction="row"
        spacing={0.5}
        sx={(theme) => ({
          flex: "0 0 auto",
          flexWrap: "wrap",
          justifyContent: { xs: "flex-start", lg: "flex-end" },
          "& .MuiButton-root": {
            fontSize: theme.typography.pxToRem(12),
            minHeight: 30,
            px: 1.5,
          },
        })}
      >
        <Button disabled={!isWorkspaceReady} onClick={onOpenCreate} size="small" variant="contained">
          Open account
        </Button>
        <Button color="inherit" disabled onClick={onOpenBatchAssign} size="small" variant="outlined">
          Batch Assign Charging Templates
        </Button>
        <Button
          color="inherit"
          disabled={!isWorkspaceReady || selectedCount === 0}
          onClick={onOpenDistributionPermissions}
          size="small"
          variant="outlined"
        >
          Set Distribution Permission
        </Button>
        <Button
          color="inherit"
          endIcon={<KeyboardArrowDownOutlinedIcon />}
          disabled={!isWorkspaceReady || (selectedCount === 0 && exportRows.length === 0)}
          onClick={() =>
            downloadClientAccountsCsv(
              selectedCount > 0 ? selectedClients : exportRows,
              selectedCount > 0 ? "client-accounts-selected" : "client-accounts-query",
            )
          }
          size="small"
          variant="outlined"
        >
          Export
        </Button>
        <ActionIconButton
          aria-label="Clear all filters"
          disabled={!hasFilterOverrides}
          onClick={onResetFilters}
          sx={{ flex: "0 0 auto" }}
          title="Clear all filters"
        >
          <RestartAltRoundedIcon fontSize="small" />
        </ActionIconButton>
      </Stack>
    </Stack>
  );

  return (
    <StickyTableLayout
      sx={{ flex: "1 1 auto", overflow: "hidden" }}
      filters={
        <Box
          aria-hidden={pageChrome.isCollapsed}
          data-collapse-progress="0.00"
          data-testid="client-page-chrome"
          ref={pageChrome.wrapperRef}
          sx={pageChrome.wrapperSx}
        >
          <Box ref={pageChrome.contentRef}>
            <FilterCard
              contentSx={{
                pb: "14px !important",
                pt: 1.25,
              }}
              header={
                <PageTabs
                  ariaLabel="Client lifecycle subpages"
                  items={clientLifecycleOrder.map((status) => ({
                    count: lifecycleCounts[status],
                    label: clientLifecycleLabels[status],
                    value: status,
                  }))}
                  onChange={onLifecycleBucketChange}
                  value={lifecycleBucket}
                />
              }
            >
              <ClientAccountFilters filters={dataView.filters} onChange={dataView.updateFilter} />
            </FilterCard>
          </Box>
        </Box>
      }
      table={
        <DataTable
          columns={[
            {
              header: "Customer Code/Name",
              key: "customerCodeName",
              minWidth: 170,
              render: renderClientCodeNameCell,
              width: 176,
            },
            {
              header: "Customer Information",
              key: "customerInformation",
              minWidth: 228,
              render: renderClientInformationCell,
              width: 244,
            },
            {
              header: "Contact Person",
              key: "contactPerson",
              minWidth: 152,
              render: renderClientContactPersonCell,
              width: 160,
            },
            {
              header: "Finance",
              key: "finance",
              minWidth: 236,
              render: renderClientFinanceCell,
              width: 248,
            },
            {
              header: "Account Setup",
              key: "setup",
              minWidth: 184,
              render: renderClientSetupCell,
              width: 192,
            },
            {
              header: "Time",
              key: "time",
              minWidth: 168,
              render: renderClientTimeCell,
              width: 176,
            },
            {
              header: "Operations",
              key: "action",
              minWidth: 140,
              render: (row) => (
                <ClientAccountRowActions
                  client={row}
                  onEdit={onEdit}
                  onObtainToken={onObtainToken}
                  onOpenPortalAccess={onOpenPortalAccess}
                  onResetPassword={onResetPassword}
                  onToggleActive={onToggleActive}
                />
              ),
              sticky: "right",
              width: 148,
            },
          ]}
          emptyMessage={`No ${clientLifecycleLabels[lifecycleBucket].toLowerCase()} client accounts found.`}
          error={error}
          fillHeight
          getRowId={(row) => row.id}
          isLoading={isLoading}
          pagination={{
            page: dataView.page,
            pageSize: dataView.pageSize,
            total,
            onPageChange: dataView.setPage,
          }}
          onScrollStateChange={pageChrome.handleTableScrollStateChange}
          rowSelection={rowSelection}
          rows={clients}
          stickyHeader
          toolbar={tableToolbar}
          toolbarPlacement="inner"
        />
      }
    />
  );
}
