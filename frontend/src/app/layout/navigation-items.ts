import type { ComponentType } from "react";

import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import QueryStatsOutlinedIcon from "@mui/icons-material/QueryStatsOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
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
    path: "/inventory",
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
    label: "Clients",
    path: "/clients",
    icon: GroupsOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Products",
    path: "/products",
    icon: CategoryOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Logistics",
    path: "/logistics",
    icon: RouteOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "B2B",
    path: "/b2b",
    icon: BusinessCenterOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Work orders",
    path: "/work-orders",
    icon: AssignmentTurnedInOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Counting",
    path: "/counting",
    icon: FactCheckOutlinedIcon,
    roles: ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"],
  },
  {
    label: "Statistics",
    path: "/statistics",
    icon: QueryStatsOutlinedIcon,
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
    path: "/security",
    icon: SecurityOutlinedIcon,
  },
];
