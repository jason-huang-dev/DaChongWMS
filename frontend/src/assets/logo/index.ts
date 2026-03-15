import lockupGold from "./dachong-lockup-gold.svg";
import lockupLight from "./dachong-lockup-light.svg";
import markGold from "./dachong-mark-gold.svg";
import markLight from "./dachong-mark-light.svg";

export const logoAssets = {
  lockup: {
    gold: lockupGold,
    light: lockupLight,
  },
  mark: {
    gold: markGold,
    light: markLight,
  },
} as const;

export type LogoKind = keyof typeof logoAssets;
export type LogoVariant = keyof (typeof logoAssets)["mark"];
