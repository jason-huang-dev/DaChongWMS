import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";

import type { WorkspaceIconNavItem } from "@/shared/components/workspace-icon-nav";

export const inboundWorkspaceItems: WorkspaceIconNavItem[] = [
  {
    label: "Standard Stock-in",
    to: "/inbound/standard-stock-in",
    icon: Inventory2OutlinedIcon,
    exact: true,
  },
  {
    label: "Import to Stock-in",
    to: "/inbound/imports",
    icon: PublishOutlinedIcon,
  },
  {
    label: "Returns to Stock In",
    to: "/inbound/returns",
    icon: AssignmentReturnOutlinedIcon,
  },
  {
    label: "Stock-in Record",
    to: "/inbound/records",
    icon: FactCheckOutlinedIcon,
  },
];
