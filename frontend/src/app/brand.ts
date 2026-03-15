export const brandColors = {
  gold: "#F3C54A",
  goldLight: "#FFF1AE",
  goldDark: "#B57812",
  copper: "#B84A24",
  copperDark: "#7D2F14",
  ink: "#20150D",
  inkMuted: "#6D5842",
  inkSoft: "#F9F1E2",
  surface: "#FFF9F0",
  surfaceMuted: "#F4ECDD",
  canvas: "#F2E9DA",
  divider: "#E4D1AE",
  panelDark: "#17110B",
  panelDarkAlt: "#2A180D",
} as const;

export const brandGradients = {
  authBackdrop:
    "radial-gradient(circle at top left, rgba(243, 197, 74, 0.32), transparent 36%), linear-gradient(135deg, #110d09 0%, #1a120b 45%, #2c180d 100%)",
  shellDrawer: "linear-gradient(180deg, #17110B 0%, #24150C 52%, #31180D 100%)",
  shellBody:
    "radial-gradient(circle at top, rgba(243, 197, 74, 0.14), transparent 28%), linear-gradient(180deg, #F7F1E7 0%, #F2E9DA 100%)",
  goldAccent: "linear-gradient(135deg, #FFF3B7 0%, #F5CB56 48%, #B57812 100%)",
  copperAccent: "linear-gradient(135deg, #D56C43 0%, #B84A24 55%, #7D2F14 100%)",
} as const;

export const brandShadows = {
  card: "0 18px 45px rgba(40, 22, 10, 0.10)",
  cardStrong: "0 22px 55px rgba(24, 14, 8, 0.18)",
  glow: "0 0 30px rgba(243, 197, 74, 0.26)",
} as const;
