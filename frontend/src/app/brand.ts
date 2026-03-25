export const brandColors = {
  accent: "#F9C344",
  accentSoft: "#FFE39A",
  accentStrong: "#795900",
  textPrimaryLight: "#1F2320",
  textSecondaryLight: "#4E5550",
  textPrimaryDark: "#E1E2E2",
  textSecondaryDark: "#B8BCBC",
  backgroundLight: "#F5F5F5",
  backgroundDark: "#1A1C1C",
  surfaceLight: "#FFFFFF",
  surfaceLightSecondary: "#ECEDE8",
  surfaceLightVariant: "#E2E4DE",
  surfaceDark: "#202222",
  surfaceDarkSecondary: "#2D2F2F",
  surfaceDarkVariant: "#44483E",
  outlineLight: "#B5BAAF",
  outlineDark: "#8C9286",
  gold: "#F9C344",
  goldLight: "#FFE39A",
  goldDark: "#795900",
  ink: "#1F2320",
  inkMuted: "#4E5550",
  inkSoft: "#E1E2E2",
  surface: "#FFFFFF",
  surfaceMuted: "#ECEDE8",
  canvas: "#F5F5F5",
  divider: "#B5BAAF",
  panelDark: "#202222",
  panelDarkAlt: "#2D2F2F",
} as const;

export const brandStatusColors = {
  success: {
    light: "#2D8A5F",
    dark: "#72C698",
  },
  info: {
    light: "#3567A6",
    dark: "#8AB4FF",
  },
  warning: {
    light: "#B17600",
    dark: "#F6CF65",
  },
  danger: {
    light: "#B64132",
    dark: "#FF8F80",
  },
} as const;

export const brandGradients = {
  authBackdropDark:
    "radial-gradient(circle at top left, rgba(249, 195, 68, 0.18), transparent 30%), linear-gradient(145deg, #171919 0%, #1A1C1C 42%, #232626 100%)",
  authBackdropLight:
    "radial-gradient(circle at top left, rgba(249, 195, 68, 0.16), transparent 28%), linear-gradient(180deg, #F8F8F7 0%, #F1F2EE 100%)",
  shellDrawerDark: "linear-gradient(180deg, #202222 0%, #1C1E1E 48%, #171919 100%)",
  shellDrawerLight: "linear-gradient(180deg, #FFFFFF 0%, #F3F4F1 52%, #ECEDE8 100%)",
  shellBodyDark:
    "radial-gradient(circle at top, rgba(249, 195, 68, 0.12), transparent 24%), linear-gradient(180deg, #1A1C1C 0%, #181A1A 100%)",
  shellBodyLight:
    "radial-gradient(circle at top, rgba(249, 195, 68, 0.14), transparent 24%), linear-gradient(180deg, #F7F7F6 0%, #EFEFEA 100%)",
  accent: "linear-gradient(135deg, #FFE39A 0%, #F9C344 50%, #795900 100%)",
  topRailDark: "linear-gradient(90deg, rgba(249, 195, 68, 0.48) 0%, rgba(249, 195, 68, 0.1) 100%)",
  topRailLight: "linear-gradient(90deg, rgba(249, 195, 68, 0.28) 0%, rgba(121, 89, 0, 0.06) 100%)",
} as const;

export const brandShadows = {
  panelLight: "0 16px 38px rgba(31, 35, 32, 0.08)",
  panelDark: "0 18px 42px rgba(0, 0, 0, 0.26)",
  floatingLight: "0 12px 28px rgba(31, 35, 32, 0.12)",
  floatingDark: "0 14px 30px rgba(0, 0, 0, 0.34)",
  accentGlow: "0 0 0 1px rgba(249, 195, 68, 0.16), 0 12px 26px rgba(121, 89, 0, 0.18)",
} as const;

export const brandMotion = {
  duration: {
    fast: "160ms",
    standard: "220ms",
    slow: "320ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const;
