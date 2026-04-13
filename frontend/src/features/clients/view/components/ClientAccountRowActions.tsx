import { useState } from "react";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import { IconButton, Menu, MenuItem, Stack, Tooltip } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
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
  const { t } = useI18n();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Stack direction="row" spacing={0.25} sx={{ justifyContent: "flex-start" }}>
        <Tooltip title={t("Portal access")}>
          <IconButton
            aria-label={t("Open portal access for {{name}}", { name: client.name })}
            onClick={() => onOpenPortalAccess(client)}
            size="small"
          >
            <ManageAccountsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("Edit client")}>
          <IconButton aria-label={t("Edit client {{name}}", { name: client.name })} onClick={() => onEdit(client)} size="small">
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("More actions")}>
          <IconButton
            aria-label={t("More actions for {{name}}", { name: client.name })}
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
          {client.is_active ? t("Deactivate") : t("Reactivate")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onResetPassword(client);
          }}
        >
          {t("Reset Password")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onObtainToken(client);
          }}
        >
          {t("Obtain Token")}
        </MenuItem>
      </Menu>
    </>
  );
}
