import { alpha, createTheme } from "@mui/material/styles";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      contrastText: brandColors.ink,
      dark: brandColors.goldDark,
      light: brandColors.goldLight,
      main: brandColors.gold,
    },
    secondary: {
      contrastText: brandColors.inkSoft,
      dark: brandColors.copperDark,
      main: brandColors.copper,
    },
    background: {
      default: brandColors.canvas,
      paper: brandColors.surface,
    },
    divider: brandColors.divider,
    text: {
      primary: brandColors.ink,
      secondary: brandColors.inkMuted,
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 800,
    },
    h6: {
      fontWeight: 800,
    },
    button: {
      letterSpacing: "0.01em",
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: brandGradients.shellBody,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(14px)",
          backgroundColor: alpha(brandColors.surface, 0.9),
          borderBottom: `1px solid ${alpha(brandColors.goldDark, 0.18)}`,
          color: brandColors.ink,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
        },
        contained: {
          backgroundImage: brandGradients.goldAccent,
          boxShadow: "0 10px 24px rgba(181, 120, 18, 0.24)",
        },
        outlined: {
          borderColor: alpha(brandColors.copper, 0.24),
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha(brandColors.goldDark, 0.12)}`,
          boxShadow: brandShadows.card,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brandColors.ink,
          fontWeight: 700,
        },
      },
    },
  },
});
