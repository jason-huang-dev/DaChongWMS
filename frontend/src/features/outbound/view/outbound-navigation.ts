import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";

import type { WorkspaceIconNavItem } from "@/shared/components/workspace-icon-nav";

export const outboundWorkspaceItems: WorkspaceIconNavItem[] = [
  {
    exact: true,
    icon: InventoryOutlinedIcon,
    label: "Stock-out list",
    to: "/outbound",
  },
  {
    icon: SpaceDashboardOutlinedIcon,
    label: "Operations workbench",
    to: "/outbound/workbench",
  },
];
