import { Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";

import type { CompanyContextRecord, WarehouseRecord } from "@/shared/types/domain";

interface WorkspaceContextSwitcherProps {
  company: CompanyContextRecord | null;
  warehouses: WarehouseRecord[];
  activeWarehouseId: number | null;
  onWarehouseChange: (warehouseId: number | null) => void;
}

export function WorkspaceContextSwitcher({
  company,
  warehouses,
  activeWarehouseId,
  onWarehouseChange,
}: WorkspaceContextSwitcherProps) {
  return (
    <Stack alignItems={{ xs: "stretch", lg: "center" }} direction={{ xs: "column", lg: "row" }} spacing={1.5}>
      {company ? <Chip label={`Workspace: ${company.label}`} variant="outlined" /> : null}
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
