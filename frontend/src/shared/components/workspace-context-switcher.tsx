import { Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
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
  const { t, translateText } = useI18n();

  return (
    <Stack alignItems={{ xs: "stretch", lg: "center" }} direction={{ xs: "column", lg: "row" }} spacing={1.5}>
      {memberships.length <= 1 ? (
        company ? <Chip label={t("shell.workspaceChip", { label: company.label })} variant="outlined" /> : null
      ) : (
        <TextField
          label={t("shell.workspaceLabel")}
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
                  {membership.staff_name} · {translateText(membership.staff_type)}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}
      {warehouses.length <= 1 ? (
        <Chip
          color="primary"
          label={
            warehouses[0]?.warehouse_name
              ? t("shell.warehouseChip", { label: warehouses[0].warehouse_name })
              : t("shell.noWarehouse")
          }
          variant="outlined"
        />
      ) : (
        <TextField
          label={t("shell.warehouseLabel")}
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
