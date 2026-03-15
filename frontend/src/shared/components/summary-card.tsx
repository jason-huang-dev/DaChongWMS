import type { DetailGridItem } from "@/shared/components/detail-grid";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";

interface SummaryCardProps {
  title: string;
  description?: string;
  items: DetailGridItem[];
}

export function SummaryCard({ title, description, items }: SummaryCardProps) {
  return (
    <DetailCard description={description} title={title}>
      <DetailGrid items={items} />
    </DetailCard>
  );
}
