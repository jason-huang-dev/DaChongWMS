import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { logoAssets, type LogoKind, type LogoVariant } from "@/assets/logo";

interface BrandLogoProps {
  alt?: string;
  kind?: LogoKind;
  sx?: SxProps<Theme>;
  variant?: LogoVariant;
}

export function BrandLogo({
  alt = "DaChong brand logo",
  kind = "lockup",
  sx,
  variant = "gold",
}: BrandLogoProps) {
  return (
    <Box
      alt={alt}
      component="img"
      src={logoAssets[kind][variant]}
      sx={{
        display: "block",
        height: "auto",
        maxWidth: "100%",
        userSelect: "none",
        width: kind === "mark" ? 72 : 220,
        ...sx,
      }}
    />
  );
}
