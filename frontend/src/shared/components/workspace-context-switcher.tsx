import { Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";

import type { CompanyContextRecord, CompanyMembershipRecord, WarehouseRecord } from "@/shared/types/domain";

interface WorkspaceContextSwitcherProps {
  company: CompanyContextRecord | null;
  memberships: CompanyMembershipRecord[];
  activeMembershipId: number | null;
  onMembershipChange: (membershipId: number) => void;
  warehouses: WarehouseRecord[];
  activeWarehouseId: number | null;
  onWarehouseChange: (warehouseId: number | null) => void;
}

export function WorkspaceContextSwitcher({
  company,
  memberships,
  activeMembershipId,
  onMembershipChange,
  warehouses,
  activeWarehouseId,
  onWarehouseChange,
}: WorkspaceContextSwitcherProps) {
  return (
    <Stack alignItems={{ xs: "stretch", lg: "center" }} direction={{ xs: "column", lg: "row" }} spacing={1.5}>
      {memberships.length <= 1 ? (
        company ? <Chip label={`Workspace: ${company.label}`} variant="outlined" /> : null
      ) : (
        <TextField
          label="Workspace"
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isFinite(nextValue)) {
              onMembershipChange(nextValue);
            }
          }}
          select
          size="small"
          sx={{ minWidth: 240 }}
          value={activeMembershipId ?? ""}
        >
          {memberships.map((membership) => (
            <MenuItem key={membership.id} value={membership.id}>
              <Stack>
                <Typography variant="body2">{membership.company_name}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {membership.staff_name} · {membership.staff_type}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}
      {warehouses.length <= 1 ? (
        <Chip
          color="primary"
          label={warehouses[0]?.warehouse_name ? `Warehouse: ${warehouses[0].warehouse_name}` : "No warehouse"}
          variant="outlined"
        />
      ) : (
        <TextField
          label="Warehouse"
          onChange={(event) => {
            const rawValue = event.target.value;
            if (!rawValue) {
              onWarehouseChange(null);
              return;
            }
            const nextValue = Number(rawValue);
            onWarehouseChange(Number.isFinite(nextValue) ? nextValue : null);
          }}
          select
          size="small"
          sx={{ minWidth: 220 }}
          value={activeWarehouseId ?? ""}
        >
          {warehouses.map((warehouse) => (
            <MenuItem key={warehouse.id} value={warehouse.id}>
              <Stack>
                <Typography variant="body2">{warehouse.warehouse_name}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {warehouse.warehouse_city || warehouse.warehouse_address}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}
