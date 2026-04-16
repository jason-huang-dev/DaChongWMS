import { Box, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import {
  ReturnOrderManagementSection,
  returnsTabItems,
} from "@/features/inbound/view/inbound-workspace-sections";
import { useInboundWorkspaceController } from "@/features/inbound/view/useInboundWorkspaceController";
import { PageTabs } from "@/shared/components/page-tabs";

export function InboundReturnsPage() {
  const { translate } = useI18n();
  const navigate = useNavigate();
  const controller = useInboundWorkspaceController();

  return (
    <Stack spacing={3}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
        <PageTabs
          ariaLabel="Returns to stock-in pages"
          items={returnsTabItems.map((item) => ({ ...item, label: translate(item.label) }))}
          onChange={() => undefined}
          value="return-order-management"
        />
      </Box>
      <ReturnOrderManagementSection
        controller={controller}
        toolbarActions={
          <Button onClick={() => navigate("/returns#return-receipts")} size="small" variant="outlined">
            {translate("Open returns workspace")}
          </Button>
        }
      />
    </Stack>
  );
}
