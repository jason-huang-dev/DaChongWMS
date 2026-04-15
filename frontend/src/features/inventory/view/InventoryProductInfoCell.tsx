import { useEffect, useRef, useState } from "react";

import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import { Box, Dialog, DialogContent, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { useI18n } from "@/app/ui-preferences";

export interface InventoryProductInfoRecord {
  merchantCode?: string | null;
  merchantSku?: string | null;
  productBarcode?: string | null;
  productName?: string | null;
}

function renderValue(value?: string | null) {
  return value || "--";
}

function buildProductThumbnailLabel(product: InventoryProductInfoRecord) {
  const source = product.productName || product.merchantSku || product.merchantCode || "PR";
  const tokens = source
    .split(/[\s_-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return "PR";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

function renderProductDetail({
  copied,
  label,
  onCopy,
  separator,
  tooltipLabel,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy?: (() => void) | undefined;
  separator: string;
  tooltipLabel: string;
  value?: string | null;
}) {
  const content = (
    <Box
      sx={{
        alignItems: "baseline",
        display: "flex",
        gap: 0.35,
        minWidth: 0,
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      <Typography
        component="span"
        color="text.secondary"
        sx={(theme) => ({
          fontSize: theme.typography.body2.fontSize,
          fontWeight: 700,
          lineHeight: 1.15,
          whiteSpace: "nowrap",
        })}
        variant="body2"
      >
        {label}
        {separator}
      </Typography>
      <Typography
        component="span"
        sx={(theme) => ({
          color: copied
            ? theme.palette.success.main
            : theme.palette.mode === "dark"
              ? theme.palette.common.white
              : theme.palette.common.black,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: 800,
          lineHeight: 1.2,
          overflow: "hidden",
          textDecoration: onCopy ? "underline dotted transparent" : "none",
          textUnderlineOffset: "0.14em",
          textOverflow: "ellipsis",
          transition: theme.transitions.create(["color", "text-decoration-color"], {
            duration: theme.transitions.duration.shorter,
          }),
          whiteSpace: "nowrap",
          width: "100%",
        })}
        variant="body2"
      >
        {renderValue(value)}
      </Typography>
    </Box>
  );

  if (!onCopy || !value) {
    return content;
  }

  return (
    <Tooltip enterDelay={120} placement="top" title={tooltipLabel}>
      <Box
        component="button"
        onClick={onCopy}
        sx={{
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "inherit",
          cursor: "copy",
          display: "block",
          m: 0,
          minWidth: 0,
          p: 0,
          textAlign: "left",
          width: "100%",
          "&:hover .inventory-product-copy-value, &:focus-visible .inventory-product-copy-value": {
            textDecorationColor: "currentColor",
          },
        }}
        type="button"
      >
        <Box
          className="inventory-product-copy-value"
          sx={{
            minWidth: 0,
            width: "100%",
          }}
        >
          {content}
        </Box>
      </Box>
    </Tooltip>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function InventoryProductInfoCell({ product }: { product: InventoryProductInfoRecord }) {
  const theme = useTheme();
  const { locale, t } = useI18n();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const thumbnailLabel = buildProductThumbnailLabel(product);
  const detailSeparator = locale === "zh-CN" ? "：" : ":";
  const defaultCopyTooltipLabel = t("Click to copy");

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyProductField = async (fieldKey: string, fieldValue: string) => {
    await copyTextToClipboard(fieldValue);
    setCopiedField(fieldKey);
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedField(null);
      copyResetTimeoutRef.current = null;
    }, 1500);
  };

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "grid",
        gap: 0.625,
        gridTemplateColumns: "48px minmax(0, 1fr)",
        justifyItems: "start",
        width: "100%",
      }}
    >
      <Box
        sx={(currentTheme) => ({
          alignItems: "center",
          alignSelf: "stretch",
          background: `linear-gradient(160deg, ${alpha(currentTheme.palette.primary.main, 0.14)} 0%, ${alpha(currentTheme.palette.secondary.main, 0.1)} 100%)`,
          border: `1px solid ${alpha(currentTheme.palette.divider, 0.8)}`,
          borderRadius: 2,
          display: "flex",
          justifyContent: "center",
          minHeight: 0,
          overflow: "hidden",
          px: 0.375,
          py: 0.5,
          width: 48,
        })}
      >
        <Box
          aria-label={t("Open product image preview")}
          component="button"
          onClick={() => setIsPreviewOpen(true)}
          sx={{
            alignItems: "center",
            appearance: "none",
            background: "transparent",
            border: 0,
            color: "inherit",
            cursor: "zoom-in",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            m: 0,
            p: 0,
            width: "100%",
          }}
        >
          <Stack alignItems="center" spacing={0.4}>
            <Inventory2RoundedIcon color="action" sx={{ fontSize: 13 }} />
            <Typography
              sx={{
                color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
                fontSize: theme.typography.body2.fontSize,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {thumbnailLabel}
            </Typography>
          </Stack>
        </Box>
      </Box>
      <Box
        sx={{
          alignItems: "flex-start",
          display: "flex",
          flexDirection: "column",
          gap: 0.15,
          justifyContent: "center",
          minWidth: 0,
          width: "100%",
        }}
      >
        {renderProductDetail({
          copied: copiedField === "merchantCode",
          label: t("Code"),
          onCopy: product.merchantCode
            ? () => {
                void handleCopyProductField("merchantCode", product.merchantCode!);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "merchantCode" ? t("Copied") : defaultCopyTooltipLabel,
          value: product.merchantCode,
        })}
        {renderProductDetail({
          copied: copiedField === "merchantSku",
          label: t("SKU"),
          onCopy: product.merchantSku
            ? () => {
                void handleCopyProductField("merchantSku", product.merchantSku!);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "merchantSku" ? t("Copied") : defaultCopyTooltipLabel,
          value: product.merchantSku,
        })}
        {renderProductDetail({
          copied: copiedField === "productBarcode",
          label: t("Barcode"),
          onCopy: product.productBarcode
            ? () => {
                void handleCopyProductField("productBarcode", product.productBarcode!);
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "productBarcode" ? t("Copied") : defaultCopyTooltipLabel,
          value: product.productBarcode,
        })}
        {renderProductDetail({
          copied: copiedField === "productName",
          label: t("Name"),
          onCopy: product.productName || product.merchantSku
            ? () => {
                void handleCopyProductField("productName", product.productName || product.merchantSku || "");
              }
            : undefined,
          separator: detailSeparator,
          tooltipLabel: copiedField === "productName" ? t("Copied") : defaultCopyTooltipLabel,
          value: product.productName || product.merchantSku,
        })}
      </Box>
      <Dialog onClose={() => setIsPreviewOpen(false)} open={isPreviewOpen}>
        <DialogContent
          sx={{
            alignItems: "center",
            backgroundColor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            justifyContent: "center",
            p: 3,
          }}
        >
          <Box
            sx={(currentTheme) => ({
              alignItems: "center",
              background: `linear-gradient(160deg, ${alpha(currentTheme.palette.primary.main, 0.16)} 0%, ${alpha(currentTheme.palette.secondary.main, 0.12)} 100%)`,
              border: `1px solid ${alpha(currentTheme.palette.divider, 0.8)}`,
              borderRadius: 3,
              display: "flex",
              height: 220,
              justifyContent: "center",
              px: 3,
              py: 2.5,
              width: 220,
            })}
          >
            <Stack alignItems="center" spacing={1.25}>
              <Inventory2RoundedIcon color="action" sx={{ fontSize: 52 }} />
              <Typography
                sx={{
                  color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black,
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                {thumbnailLabel}
              </Typography>
            </Stack>
          </Box>
          <Typography sx={{ maxWidth: 260, textAlign: "center" }} variant="body2">
            {product.productName || product.merchantSku || "--"}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
