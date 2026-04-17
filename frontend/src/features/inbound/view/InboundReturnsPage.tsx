import { Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import {
  ReturnOrderManagementSection,
  returnsTabItems,
} from "@/features/inbound/view/inbound-workspace-sections";
import { useInboundWorkspaceController } from "@/features/inbound/view/useInboundWorkspaceController";
import { PageTabs } from "@/shared/components/page-tabs";
import { WorkbenchPageTemplate } from "@/shared/components/workbench-page-template";

export function InboundReturnsPage() {
  const { translate } = useI18n();
  const navigate = useNavigate();
  const controller = useInboundWorkspaceController();

  return (
    <WorkbenchPageTemplate
      hero={
        <Stack spacing={0.75}>
          <Typography variant="h6">Returns routed back into stock</Typography>
          <Typography color="text.secondary" variant="body2">
            Monitor inbound return approvals and jump into the full returns workspace when the dock needs deeper investigation.
          </Typography>
        </Stack>
      }
      navigation={
        <PageTabs
          ariaLabel="Returns to stock-in pages"
          items={returnsTabItems.map((item) => ({ ...item, label: translate(item.label) }))}
          onChange={() => undefined}
          value="return-order-management"
        />
      }
    >
      <ReturnOrderManagementSection
        controller={controller}
        toolbarActions={
          <Button onClick={() => navigate("/returns#return-receipts")} size="small" variant="outlined">
            {translate("Open returns workspace")}
          </Button>
        }
      />
    </WorkbenchPageTemplate>
  );
}
