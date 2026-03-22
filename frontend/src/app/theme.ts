import { zhCN } from "@mui/material/locale";
import { enUS } from "@mui/material/locale";
import { alpha, createTheme } from "@mui/material/styles";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import type { AppLocale, AppThemeMode } from "@/app/ui-preferences-storage";

const localeThemes = {
  en: enUS,
  "zh-CN": zhCN,
} as const satisfies Record<AppLocale, typeof enUS>;

export function createAppTheme(themeMode: AppThemeMode, locale: AppLocale) {
  const isDark = themeMode === "dark";

  return createTheme(
    {
      palette: {
        mode: themeMode,
        primary: {
          contrastText: brandColors.ink,
          dark: brandColors.goldDark,
          light: brandColors.goldLight,
          main: brandColors.gold,
        },
        secondary: {
          contrastText: isDark ? brandColors.inkSoft : brandColors.ink,
          dark: brandColors.copperDark,
          main: brandColors.copper,
        },
        background: {
          default: isDark ? "#120D09" : brandColors.canvas,
          paper: isDark ? "#1D140D" : brandColors.surface,
        },
        divider: isDark ? alpha(brandColors.goldLight, 0.14) : brandColors.divider,
        text: {
          primary: isDark ? brandColors.inkSoft : brandColors.ink,
          secondary: isDark ? alpha(brandColors.inkSoft, 0.72) : brandColors.inkMuted,
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
              background: isDark
                ? "radial-gradient(circle at top, rgba(243, 197, 74, 0.18), transparent 28%), linear-gradient(180deg, #140f0a 0%, #1c140d 100%)"
                : brandGradients.shellBody,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backdropFilter: "blur(14px)",
              backgroundColor: isDark ? alpha("#1D140D", 0.88) : alpha(brandColors.surface, 0.9),
              borderBottom: `1px solid ${isDark ? alpha(brandColors.goldLight, 0.14) : alpha(brandColors.goldDark, 0.18)}`,
              color: isDark ? brandColors.inkSoft : brandColors.ink,
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
              borderColor: isDark ? alpha(brandColors.goldLight, 0.2) : alpha(brandColors.copper, 0.24),
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              border: `1px solid ${isDark ? alpha(brandColors.goldLight, 0.12) : alpha(brandColors.goldDark, 0.12)}`,
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
              color: isDark ? brandColors.inkSoft : brandColors.ink,
              fontWeight: 700,
            },
          },
        },
      },
    },
    localeThemes[locale],
  );
}
