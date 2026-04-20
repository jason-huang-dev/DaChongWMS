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

import {
  automationAccessPermissionCodes,
  b2bPermissionGroups,
  clientsAccessPermissionCodes,
  countingAccessPermissionCodes,
  feesAccessPermissionCodes,
  inboundAccessPermissionCodes,
  inventoryAccessPermissionCodes,
  integrationsAccessPermissionCodes,
  logisticsAccessPermissionCodes,
  outboundAccessPermissionCodes,
  productsAccessPermissionCodes,
  returnsAccessPermissionCodes,
  statisticsPermissionGroups,
  transfersAccessPermissionCodes,
  workOrdersAccessPermissionCodes,
} from "@/app/access";

export interface NavigationItem {
  label: string;
  path: string;
  icon: ComponentType<SvgIconProps>;
  permissionCodes?: readonly string[];
  permissionGroups?: readonly (readonly string[])[];
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
    permissionCodes: inventoryAccessPermissionCodes,
  },
  {
    label: "Inbound",
    path: "/inbound",
    icon: MoveToInboxOutlinedIcon,
    permissionCodes: inboundAccessPermissionCodes,
  },
  {
    label: "Outbound",
    path: "/outbound",
    icon: LocalShippingOutlinedIcon,
    permissionCodes: outboundAccessPermissionCodes,
  },
  {
    label: "Transfers",
    path: "/transfers",
    icon: SwapHorizOutlinedIcon,
    permissionCodes: transfersAccessPermissionCodes,
  },
  {
    label: "Returns",
    path: "/returns",
    icon: AssignmentReturnOutlinedIcon,
    permissionCodes: returnsAccessPermissionCodes,
  },
  {
    label: "Clients",
    path: "/clients",
    icon: GroupsOutlinedIcon,
    permissionCodes: clientsAccessPermissionCodes,
  },
  {
    label: "Products",
    path: "/products",
    icon: CategoryOutlinedIcon,
    permissionCodes: productsAccessPermissionCodes,
  },
  {
    label: "Logistics",
    path: "/logistics",
    icon: RouteOutlinedIcon,
    permissionCodes: logisticsAccessPermissionCodes,
  },
  {
    label: "B2B",
    path: "/b2b",
    icon: BusinessCenterOutlinedIcon,
    permissionGroups: b2bPermissionGroups,
  },
  {
    label: "Work orders",
    path: "/work-orders",
    icon: AssignmentTurnedInOutlinedIcon,
    permissionCodes: workOrdersAccessPermissionCodes,
  },
  {
    label: "Counting",
    path: "/counting",
    icon: FactCheckOutlinedIcon,
    permissionCodes: countingAccessPermissionCodes,
  },
  {
    label: "Statistics",
    path: "/statistics",
    icon: QueryStatsOutlinedIcon,
    permissionGroups: statisticsPermissionGroups,
  },
  {
    label: "Automation",
    path: "/automation",
    icon: SettingsSuggestOutlinedIcon,
    permissionCodes: automationAccessPermissionCodes,
  },
  {
    label: "Integrations",
    path: "/integrations",
    icon: HubOutlinedIcon,
    permissionCodes: integrationsAccessPermissionCodes,
  },
  {
    label: "Finance",
    path: "/finance",
    icon: RequestQuoteOutlinedIcon,
    permissionCodes: feesAccessPermissionCodes,
  },
  {
    label: "Security",
    path: "/security",
    icon: SecurityOutlinedIcon,
  },
];
