import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";

import type { WorkspaceIconNavItem } from "@/shared/components/workspace-icon-nav";

export const inventoryWorkspaceItems: WorkspaceIconNavItem[] = [
  {
    label: "Inventory Information",
    to: "/inventory",
    icon: Inventory2OutlinedIcon,
    exact: true,
  },
  {
    label: "Stock Age Report",
    to: "/inventory/aging",
    icon: HistoryOutlinedIcon,
  },
  {
    label: "Inventory Adjustment",
    to: "/inventory/adjustments",
    icon: TuneOutlinedIcon,
  },
  {
    label: "Inter-warehouse Transfer",
    to: "/inventory/cross-warehouse",
    icon: CompareArrowsOutlinedIcon,
  },
];
