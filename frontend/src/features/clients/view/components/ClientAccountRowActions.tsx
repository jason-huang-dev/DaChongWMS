import { useState } from "react";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import { IconButton, Menu, MenuItem, Stack, Tooltip } from "@mui/material";

import type { ClientAccountRecord } from "@/features/clients/model/types";

interface ClientAccountRowActionsProps {
  client: ClientAccountRecord;
  onEdit: (client: ClientAccountRecord) => void;
  onToggleActive: (client: ClientAccountRecord, nextActive: boolean) => Promise<void> | void;
  onOpenPortalAccess: (client: ClientAccountRecord) => void;
  onResetPassword: (client: ClientAccountRecord) => void;
  onObtainToken: (client: ClientAccountRecord) => void;
}

export function ClientAccountRowActions({
  client,
  onEdit,
  onToggleActive,
  onOpenPortalAccess,
  onResetPassword,
  onObtainToken,
}: ClientAccountRowActionsProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Stack direction="row" spacing={0.25} sx={{ justifyContent: "flex-start" }}>
        <Tooltip title="Portal access">
          <IconButton aria-label={`Open portal access for ${client.name}`} onClick={() => onOpenPortalAccess(client)} size="small">
            <ManageAccountsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit client">
          <IconButton aria-label={`Edit client ${client.name}`} onClick={() => onEdit(client)} size="small">
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="More actions">
          <IconButton
            aria-label={`More actions for ${client.name}`}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            size="small"
          >
            <MoreHorizOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Menu anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} open={Boolean(menuAnchor)}>
        <MenuItem
          onClick={async () => {
            setMenuAnchor(null);
            await onToggleActive(client, !client.is_active);
          }}
        >
          {client.is_active ? "Deactivate" : "Reactivate"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onResetPassword(client);
          }}
        >
          Reset Password
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onObtainToken(client);
          }}
        >
          Obtain Token
        </MenuItem>
      </Menu>
    </>
  );
}
