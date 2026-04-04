import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import { Button, Chip, Stack, Typography } from "@mui/material";

import type { ClientWorkbenchFilters } from "@/features/clients/controller/useClientsController";
import {
  clientLifecycleLabels,
  clientLifecycleOrder,
  downloadClientAccountsCsv,
  listClientContactPeople,
  resolveClientLifecycleStatus,
} from "@/features/clients/model/client-accounts";
import type { ClientAccountRecord, ClientLifecycleStatus } from "@/features/clients/model/types";
import { ClientAccountFilters } from "@/features/clients/view/components/ClientAccountFilters";
import { ClientAccountRowActions } from "@/features/clients/view/components/ClientAccountRowActions";
import { BulkActionBar } from "@/shared/components/bulk-action-bar";
import { DataTable, type DataTableRowSelection } from "@/shared/components/data-table";
import { FilterCard } from "@/shared/components/filter-card";
import { PageTabs } from "@/shared/components/page-tabs";
import { StatusChip } from "@/shared/components/status-chip";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import { formatNumber } from "@/shared/utils/format";

interface ClientAccountTableProps {
  clients: ClientAccountRecord[];
  exportRows: ClientAccountRecord[];
  total: number;
  isLoading: boolean;
  isWorkspaceReady: boolean;
  error?: string | null;
  dataView: UseDataViewResult<ClientWorkbenchFilters>;
  filterOptions: {
    warehouses: string[];
    chargingTemplates: string[];
    settlementCurrencies: string[];
    contactPeople: string[];
    distributionModes: string[];
  };
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
  onOpenOmsLoginDirectory: () => void;
  onToggleActive: (client: ClientAccountRecord, nextActive: boolean) => Promise<void> | void;
  onOpenPortalAccess: (client: ClientAccountRecord) => void;
  onOpenOmsLogin: (client: ClientAccountRecord) => void;
}

function renderClientNameCell(row: ClientAccountRecord) {
  return (
    <Stack spacing={0.5}>
      <Typography fontWeight={700} variant="body2">
        {row.code}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {row.name}
      </Typography>
    </Stack>
  );
}

function renderClientContactCell(row: ClientAccountRecord) {
  const contacts = listClientContactPeople(row);
  const primaryContact = contacts[0];

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2">{primaryContact?.email ?? row.contact_email ?? "--"}</Typography>
      <Typography color="text.secondary" variant="body2">
        {primaryContact?.phone ?? row.contact_phone ?? "--"}
      </Typography>
    </Stack>
  );
}

function renderClientContactPeopleCell(row: ClientAccountRecord) {
  const contacts = listClientContactPeople(row);
  if (contacts.length === 0) {
    return "--";
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={0.75}>
      {contacts.slice(0, 2).map((contact) => (
        <Chip key={`${contact.name}-${contact.email ?? ""}-${contact.phone ?? ""}`} label={contact.name} size="small" variant="outlined" />
      ))}
      {contacts.length > 2 ? <Chip label={`+${contacts.length - 2} more`} size="small" /> : null}
    </Stack>
  );
}

export function ClientAccountTable({
  clients,
  exportRows,
  total,
  isLoading,
  isWorkspaceReady,
  error,
  dataView,
  filterOptions,
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
  onOpenOmsLoginDirectory,
  onToggleActive,
  onOpenPortalAccess,
  onOpenOmsLogin,
}: ClientAccountTableProps) {
  const hasActiveSelection = selectedClients.some((client) => client.is_active);
  const hasInactiveSelection = selectedClients.some((client) => !client.is_active);

  return (
    <Stack spacing={2}>
      <FilterCard
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
        <ClientAccountFilters
          activeFilterCount={dataView.activeFilterCount}
          filterOptions={filterOptions}
          filters={dataView.filters}
          onChange={dataView.updateFilter}
          onReset={onResetFilters}
        />
      </FilterCard>

      <DataTable
        columns={[
        {
          header: "Customer code/name",
          key: "client",
          minWidth: 160,
          render: renderClientNameCell,
          width: 190,
        },
          {
            header: "Contacts",
            key: "contacts",
            minWidth: 180,
            render: renderClientContactCell,
            width: 240,
          },
          {
            header: "Company name",
            key: "company",
            minWidth: 180,
            render: (row) => row.company_name ?? row.name,
            width: 200,
          },
          {
            header: "Settlement currency",
            key: "currency",
          minWidth: 120,
          render: (row) => row.settlement_currency ?? "--",
          width: 160,
        },
          {
            header: "Contact person",
            key: "contactPeople",
          minWidth: 180,
          render: renderClientContactPeopleCell,
          width: 220,
        },
          {
            header: "Total available balance",
            key: "balance",
            align: "right",
          minWidth: 150,
          render: (row) => formatNumber(row.total_available_balance ?? 0),
          width: 170,
        },
          {
            header: "Credit limit/used",
            key: "credit",
            align: "right",
          minWidth: 160,
          render: (row) => `${formatNumber(row.credit_limit ?? 0)} / ${formatNumber(row.credit_used ?? 0)}`,
          width: 170,
        },
          {
            header: "Authorized qty",
            key: "authorizedQty",
            align: "right",
            minWidth: 120,
            render: (row) => formatNumber(row.authorized_order_quantity ?? 0),
            width: 130,
          },
          {
            header: "Limit docs",
            key: "limitDocs",
            minWidth: 110,
            render: (row) => (row.limit_balance_documents ? "Enabled" : "--"),
            width: 120,
          },
          {
            header: "Status",
            key: "status",
            minWidth: 140,
            render: (row) => <StatusChip status={resolveClientLifecycleStatus(row)} />,
            width: 150,
          },
          {
            header: "Operation",
            key: "action",
            minWidth: 160,
            render: (row) => (
              <ClientAccountRowActions
                client={row}
                onEdit={onEdit}
                onOpenOmsLogin={onOpenOmsLogin}
                onOpenPortalAccess={onOpenPortalAccess}
                onToggleActive={onToggleActive}
              />
            ),
            width: 180,
          },
        ]}
        emptyMessage={`No ${clientLifecycleLabels[lifecycleBucket].toLowerCase()} client accounts found.`}
        error={error}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        pagination={{
          page: dataView.page,
          pageSize: dataView.pageSize,
          total,
          onPageChange: dataView.setPage,
        }}
        rowSelection={rowSelection}
        rows={clients}
        toolbar={
          <Stack spacing={selectedCount > 0 ? 1.5 : 0}>
            <Stack
              alignItems={{ lg: "center" }}
              direction={{ xs: "column", lg: "row" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack direction={{ xs: "column", sm: "row" }} flexWrap="wrap" gap={1.5}>
                <Button disabled={!isWorkspaceReady} onClick={onOpenCreate} sx={{ px: 2.5 }} variant="contained">
                  Open account
                </Button>
                <Button color="inherit" disabled onClick={onOpenBatchAssign} sx={{ px: 2.5 }} variant="outlined">
                  Batch Assign Charging Templates
                </Button>
                <Button
                  color="inherit"
                  disabled={!isWorkspaceReady || selectedCount === 0}
                  onClick={onOpenDistributionPermissions}
                  sx={{ px: 2.5 }}
                  variant="outlined"
                >
                  Set Distribution Permission
                </Button>
                <Button
                  color="inherit"
                  disabled={!isWorkspaceReady || (selectedCount === 0 && exportRows.length === 0)}
                  endIcon={<KeyboardArrowDownOutlinedIcon />}
                  onClick={() =>
                    downloadClientAccountsCsv(
                      selectedCount > 0 ? selectedClients : exportRows,
                      selectedCount > 0 ? "client-accounts-selected" : "client-accounts-query",
                    )
                  }
                  sx={{ px: 2.5 }}
                  variant="outlined"
                >
                  Export
                </Button>
              </Stack>
              <Button
                color="inherit"
                endIcon={<ChevronRightRoundedIcon />}
                onClick={onOpenOmsLoginDirectory}
                sx={{ alignSelf: { lg: "center" }, ml: { lg: "auto" }, px: 0.5 }}
              >
                OMS Login URL
              </Button>
            </Stack>
            <BulkActionBar
              actions={[
                {
                  color: "inherit",
                  disabled: !hasActiveSelection,
                  key: "deactivate",
                  label: "Deactivate selected",
                  onClick: onBulkDeactivate,
                  variant: "outlined",
                },
                {
                  disabled: !hasInactiveSelection,
                  key: "reactivate",
                  label: "Reactivate selected",
                  onClick: onBulkReactivate,
                  variant: "outlined",
                },
                {
                  key: "export",
                  label: "Export selected",
                  onClick: () => downloadClientAccountsCsv(selectedClients, "client-accounts-selected"),
                  variant: "contained",
                },
              ]}
              onClear={onClearSelection}
              selectedCount={selectedCount}
            />
          </Stack>
        }
      />
    </Stack>
  );
}
