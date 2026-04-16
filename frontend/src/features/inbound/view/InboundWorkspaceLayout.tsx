import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";

import { inboundWorkspaceItems } from "@/features/inbound/view/inbound-navigation";
import { WorkspaceSectionNav } from "@/shared/components/workspace-section-nav";

export function InboundWorkspaceLayout() {
  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", lg: "248px minmax(0, 1fr)" },
      }}
    >
      <WorkspaceSectionNav ariaLabel="Stock-in workspace groups" items={inboundWorkspaceItems} />
      <Box sx={{ minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
