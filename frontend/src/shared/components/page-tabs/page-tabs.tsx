import { Tab, Tabs } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface PageTabItem<TValue extends string> {
  count?: number | string;
  disabled?: boolean;
  label: string;
  value: TValue;
}

interface PageTabsProps<TValue extends string> {
  ariaLabel: string;
  items: PageTabItem<TValue>[];
  onChange: (value: TValue) => void;
  sx?: SxProps<Theme>;
  value: TValue;
}

export function PageTabs<TValue extends string>({
  ariaLabel,
  items,
  onChange,
  sx,
  value,
}: PageTabsProps<TValue>) {
  return (
    <Tabs
      allowScrollButtonsMobile={false}
      aria-label={ariaLabel}
      onChange={(_event, nextValue) => onChange(nextValue as TValue)}
      scrollButtons={false}
      value={value}
      variant="scrollable"
      sx={[
        (theme) => ({
          minHeight: 0,
          width: "100%",
          "& .MuiTabs-scroller": {
            display: "flex",
            justifyContent: "flex-start",
            overflowX: "auto !important",
          },
          "& .MuiTabs-flexContainer, & .MuiTabs-list": {
            justifyContent: "flex-start",
            minHeight: 0,
          },
          "& .MuiTab-root": {
            alignItems: "center",
            color: theme.palette.text.secondary,
            fontSize: theme.typography.pxToRem(13),
            fontWeight: 600,
            height: "auto",
            justifyContent: "center",
            lineHeight: 1.25,
            minWidth: "max-content",
            minHeight: 0,
            px: 1.25,
            py: "2px",
            textAlign: "center",
            textTransform: "none",
            whiteSpace: "nowrap",
          },
          "& .MuiTab-root + .MuiTab-root": {
            ml: 4,
          },
          "& .Mui-selected": {
            color: theme.palette.text.primary,
            fontWeight: 700,
          },
          "& .MuiTabs-indicator": {
            display: "none",
          },
          "& .MuiTabs-scrollButtons": {
            display: "none !important",
          },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {items.map((item) => (
        <Tab
          key={item.value}
          disabled={item.disabled}
          label={typeof item.count === "undefined" ? item.label : `${item.label}(${item.count})`}
          value={item.value}
        />
      ))}
    </Tabs>
  );
}
