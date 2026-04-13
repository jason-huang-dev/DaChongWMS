import type { TranslatableText } from "@/app/i18n";
import type { DetailGridItem } from "@/shared/components/detail-grid";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";

interface SummaryCardProps {
  title: TranslatableText;
  description?: TranslatableText;
  items: DetailGridItem[];
}

export function SummaryCard({ title, description, items }: SummaryCardProps) {
  return (
    <DetailCard description={description} title={title}>
      <DetailGrid items={items} />
    </DetailCard>
  );
}
