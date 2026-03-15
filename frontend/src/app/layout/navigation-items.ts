import type { ComponentType } from "react";

import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import type { SvgIconProps } from "@mui/material/SvgIcon";

export interface NavigationItem {
  label: string;
  path: string;
  icon: ComponentType<SvgIconProps>;
  roles?: string[];
}

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: DashboardOutlinedIcon,
  },
  {
    label: "Inventory",
    path: "/inventory/balances",
    icon: Inventory2OutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Inbound",
    path: "/inbound",
    icon: MoveToInboxOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "StockControl"],
  },
  {
    label: "Outbound",
    path: "/outbound",
    icon: LocalShippingOutlinedIcon,
    roles: ["Manager", "Supervisor", "Outbound", "StockControl"],
  },
  {
    label: "Transfers",
    path: "/transfers",
    icon: SwapHorizOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Returns",
    path: "/returns",
    icon: AssignmentReturnOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Counting",
    path: "/counting",
    icon: FactCheckOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Automation",
    path: "/automation",
    icon: SettingsSuggestOutlinedIcon,
    roles: ["Manager", "Supervisor", "StockControl"],
  },
  {
    label: "Integrations",
    path: "/integrations",
    icon: HubOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Finance",
    path: "/finance",
    icon: RequestQuoteOutlinedIcon,
    roles: ["Finance", "Manager", "Supervisor"],
  },
  {
    label: "Security",
    path: "/mfa/enroll",
    icon: SecurityOutlinedIcon,
  },
];
