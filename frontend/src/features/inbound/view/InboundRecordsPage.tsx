import { Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import {
  ListingRecordSection,
  ReceivingRecordSection,
  SigningRecordSection,
  StockInRecordSection,
  recordTabItems,
  type RecordTabValue,
} from "@/features/inbound/view/inbound-workspace-sections";
import { useInboundWorkspaceController } from "@/features/inbound/view/useInboundWorkspaceController";
import { useInboundWorkspaceTab } from "@/features/inbound/view/useInboundWorkspaceTab";
import { PageTabs } from "@/shared/components/page-tabs";
import { WorkbenchPageTemplate } from "@/shared/components/workbench-page-template";

const recordTabValues = recordTabItems.map((item) => item.value);

export function InboundRecordsPage() {
  const { translate } = useI18n();
  const { setValue, value } = useInboundWorkspaceTab<RecordTabValue>(recordTabValues, "stock-in-record");
  const controller = useInboundWorkspaceController();

  return (
    <WorkbenchPageTemplate
      hero={
        <Stack spacing={0.75}>
          <Typography variant="h6">Inbound execution records</Typography>
          <Typography color="text.secondary" variant="body2">
            Review the full trail from ASN creation through signing, receiving, and listing without switching workspaces.
          </Typography>
        </Stack>
      }
      navigation={
        <PageTabs
          ariaLabel="Stock-in record pages"
          items={recordTabItems.map((item) => ({ ...item, label: translate(item.label) }))}
          onChange={setValue}
          value={value}
        />
      }
    >
      {value === "stock-in-record" ? <StockInRecordSection controller={controller} /> : null}
      {value === "signing-record" ? <SigningRecordSection controller={controller} /> : null}
      {value === "receiving-record" ? <ReceivingRecordSection controller={controller} /> : null}
      {value === "listing-record" ? <ListingRecordSection controller={controller} /> : null}
    </WorkbenchPageTemplate>
  );
}
