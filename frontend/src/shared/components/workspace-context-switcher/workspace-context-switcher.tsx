import { useMemo, useState } from "react";

import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { ButtonBase, Chip, Menu, MenuItem, Stack, TextField, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { getStaffRoleLabelKey } from "@/shared/i18n/system-labels";
import type { CompanyContextRecord, CompanyMembershipRecord, WarehouseRecord } from "@/shared/types/domain";

interface WorkspaceContextSwitcherProps {
  company: CompanyContextRecord | null;
  memberships: CompanyMembershipRecord[];
  activeMembershipId: number | null;
  onMembershipChange: (membershipId: number) => void;
  warehouses: WarehouseRecord[];
  activeWarehouseId: number | null;
  onWarehouseChange: (warehouseId: number | null) => void;
  compact?: boolean;
}

export function WorkspaceContextSwitcher({
  company,
  memberships,
  activeMembershipId,
  onMembershipChange,
  warehouses,
  activeWarehouseId,
  onWarehouseChange,
  compact = false,
}: WorkspaceContextSwitcherProps) {
  const { t, translate } = useI18n();
  const workspaceFieldWidth = compact ? { md: 124, lg: 136, xl: 152 } : 240;
  const warehouseFieldWidth = compact ? { md: 112, lg: 124, xl: 140 } : 220;
  const [workspaceMenuAnchor, setWorkspaceMenuAnchor] = useState<HTMLElement | null>(null);
  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.id === activeMembershipId) ?? memberships[0] ?? null,
    [activeMembershipId, memberships],
  );
  const activeWorkspaceLabel = activeMembership?.company_name ?? company?.label ?? t("shell.noWorkspace");

  if (compact) {
    return (
      <>
        <ButtonBase
          aria-controls={workspaceMenuAnchor ? "workspace-switcher-menu" : undefined}
          aria-expanded={workspaceMenuAnchor ? "true" : undefined}
          aria-haspopup={memberships.length > 1 ? "menu" : undefined}
          aria-label={t("shell.workspaceChip", { label: activeWorkspaceLabel })}
          disabled={memberships.length <= 1}
          onClick={(event) => setWorkspaceMenuAnchor(event.currentTarget)}
          sx={{
            alignItems: "center",
            borderRadius: 2,
            color: "primary.main",
            display: "flex",
            gap: 0.5,
            justifyContent: "flex-start",
            minWidth: 0,
            maxWidth: "100%",
            px: 0.375,
            py: 0.125,
            textAlign: "left",
            width: "auto",
            "&:hover": {
              backgroundColor: "action.hover",
            },
            "&.Mui-disabled": {
              color: "primary.main",
              opacity: 1,
            },
          }}
        >
          <Typography noWrap sx={{ color: "inherit", fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
            {activeWorkspaceLabel}
          </Typography>
          {memberships.length > 1 ? (
            <KeyboardArrowDownRoundedIcon sx={{ color: "inherit", flexShrink: 0, fontSize: 18 }} />
          ) : null}
        </ButtonBase>
        <Menu
          anchorEl={workspaceMenuAnchor}
          id="workspace-switcher-menu"
          onClose={() => setWorkspaceMenuAnchor(null)}
          open={Boolean(workspaceMenuAnchor)}
        >
          {memberships.map((membership) => (
            <MenuItem
              key={membership.id}
              onClick={() => {
                onMembershipChange(membership.id);
                setWorkspaceMenuAnchor(null);
              }}
              selected={membership.id === activeMembershipId}
            >
              <Stack>
                <Typography variant="body2">{membership.company_name}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {membership.staff_name} ·{" "}
                  {getStaffRoleLabelKey(membership.staff_type)
                    ? translate(getStaffRoleLabelKey(membership.staff_type)!)
                    : membership.staff_type}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <Stack
      alignItems={compact ? "center" : { xs: "stretch", lg: "center" }}
      direction={compact ? "row" : { xs: "column", lg: "row" }}
      spacing={compact ? 1 : 1.5}
      sx={{
        minWidth: 0,
        "& .MuiFormControl-root": {
          flexShrink: 1,
        },
      }}
    >
      {memberships.length <= 1 ? (
        company ? (
          <Chip
            label={compact ? company.label : t("shell.workspaceChip", { label: company.label })}
            size={compact ? "small" : "medium"}
            variant="outlined"
          />
        ) : null
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
          sx={{ minWidth: workspaceFieldWidth }}
          value={activeMembershipId ?? ""}
        >
          {memberships.map((membership) => (
            <MenuItem key={membership.id} value={membership.id}>
              <Stack>
                <Typography variant="body2">{membership.company_name}</Typography>
                <Typography color="text.secondary" variant="caption">
                  {membership.staff_name} ·{" "}
                  {getStaffRoleLabelKey(membership.staff_type)
                    ? translate(getStaffRoleLabelKey(membership.staff_type)!)
                    : membership.staff_type}
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
              ? compact
                ? warehouses[0].warehouse_name
                : t("shell.warehouseChip", { label: warehouses[0].warehouse_name })
              : t("shell.noWarehouse")
          }
          size={compact ? "small" : "medium"}
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
          sx={{ minWidth: warehouseFieldWidth }}
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
