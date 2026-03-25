import dachongLogoFromImage from "./dachong_logo_from_image.png";

export const logoAssets = {
  lockup: {
    gold: dachongLogoFromImage,
    light: dachongLogoFromImage,
  },
  mark: {
    gold: dachongLogoFromImage,
    light: dachongLogoFromImage,
  },
} as const;

export type LogoKind = keyof typeof logoAssets;
export type LogoVariant = keyof (typeof logoAssets)["mark"];
