import GppBadOutlinedIcon from "@mui/icons-material/GppBadOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";

import type { WorkspaceIconNavItem } from "@/shared/components/workspace-icon-nav";

export const clientWorkspaceItems: WorkspaceIconNavItem[] = [
  {
    label: "Pending approval",
    to: "/clients/pending-approval",
    icon: PendingActionsOutlinedIcon,
    exact: true,
  },
  {
    label: "Approved",
    to: "/clients/approved",
    icon: TaskAltOutlinedIcon,
    exact: true,
  },
  {
    label: "Review not approved",
    to: "/clients/review-not-approved",
    icon: GppBadOutlinedIcon,
    exact: true,
  },
  {
    label: "Deactivated",
    to: "/clients/deactivated",
    icon: PersonOffOutlinedIcon,
    exact: true,
  },
];
