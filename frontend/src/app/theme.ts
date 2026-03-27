import { zhCN } from "@mui/material/locale";
import { enUS } from "@mui/material/locale";
import { alpha, createTheme } from "@mui/material/styles";

import { brandColors, brandGradients, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import type { AppLocale, AppThemeMode } from "@/app/ui-preferences-storage";

const localeThemes = {
  en: enUS,
  "zh-CN": zhCN,
} as const satisfies Record<AppLocale, typeof enUS>;

export function createAppTheme(themeMode: AppThemeMode, locale: AppLocale) {
  const isDark = themeMode === "dark";
  const tokens = isDark
    ? {
        background: brandColors.backgroundDark,
        surface: brandColors.surfaceDark,
        surfaceSecondary: brandColors.surfaceDarkSecondary,
        surfaceVariant: brandColors.surfaceDarkVariant,
        textPrimary: brandColors.textPrimaryDark,
        textSecondary: brandColors.textSecondaryDark,
        outline: brandColors.outlineDark,
      }
    : {
        background: brandColors.backgroundLight,
        surface: brandColors.surfaceLight,
        surfaceSecondary: brandColors.surfaceLightSecondary,
        surfaceVariant: brandColors.surfaceLightVariant,
        textPrimary: brandColors.textPrimaryLight,
        textSecondary: brandColors.textSecondaryLight,
        outline: brandColors.outlineLight,
      };

  return createTheme(
    {
      palette: {
        mode: themeMode,
        primary: {
          contrastText: brandColors.textPrimaryLight,
          dark: brandColors.accentStrong,
          light: brandColors.accentSoft,
          main: brandColors.accent,
        },
        secondary: {
          contrastText: tokens.textPrimary,
          dark: tokens.surfaceVariant,
          light: tokens.surfaceSecondary,
          main: tokens.surfaceVariant,
        },
        background: {
          default: tokens.background,
          paper: tokens.surface,
        },
        divider: alpha(tokens.outline, isDark ? 0.34 : 0.56),
        error: {
          main: isDark ? brandStatusColors.danger.dark : brandStatusColors.danger.light,
        },
        info: {
          main: isDark ? brandStatusColors.info.dark : brandStatusColors.info.light,
        },
        text: {
          primary: tokens.textPrimary,
          secondary: tokens.textSecondary,
        },
        success: {
          main: isDark ? brandStatusColors.success.dark : brandStatusColors.success.light,
        },
        warning: {
          main: isDark ? brandStatusColors.warning.dark : brandStatusColors.warning.light,
        },
      },
      shape: {
        borderRadius: 10,
      },
      typography: {
        fontFamily: '"Manrope", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        h3: {
          fontSize: "1rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        },
        h4: {
          fontSize: "1rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        },
        h5: {
          fontSize: "0.875rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        },
        h6: {
          fontSize: "0.75rem",
          fontWeight: 700,
          lineHeight: 1.3,
        },
        body1: {
          fontSize: "0.625rem",
          lineHeight: 1.6,
        },
        body2: {
          fontSize: "0.625rem",
          lineHeight: 1.45,
        },
        button: {
          fontSize: "0.625rem",
          letterSpacing: "0.01em",
          textTransform: "none",
          fontWeight: 700,
        },
        caption: {
          fontSize: "0.5rem",
          lineHeight: 1.4,
        },
        overline: {
          fontSize: "0.5rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          lineHeight: 1.5,
          textTransform: "uppercase",
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            ":root": {
              colorScheme: themeMode,
            },
            "*, *::before, *::after": {
              boxSizing: "border-box",
            },
            html: {
              scrollBehavior: "smooth",
            },
            body: {
              background: isDark ? brandGradients.shellBodyDark : brandGradients.shellBodyLight,
              color: tokens.textPrimary,
              textRendering: "optimizeLegibility",
            },
            "a, button": {
              transition: [
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
            },
            "::selection": {
              backgroundColor: alpha(brandColors.accent, isDark ? 0.28 : 0.18),
            },
            "@media (prefers-reduced-motion: reduce)": {
              html: {
                scrollBehavior: "auto",
              },
              "*, *::before, *::after": {
                animationDuration: "0.01ms !important",
                animationIterationCount: "1 !important",
                scrollBehavior: "auto !important",
                transitionDuration: "0.01ms !important",
              },
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backdropFilter: "blur(18px)",
              backgroundColor: alpha(tokens.surface, isDark ? 0.84 : 0.9),
              borderBottom: `1px solid ${alpha(tokens.outline, isDark ? 0.26 : 0.34)}`,
              boxShadow: "none",
              color: tokens.textPrimary,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              minHeight: 36,
              paddingInline: 14,
              transition: [
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:active": {
                transform: "translateY(0)",
              },
            },
            contained: {
              backgroundImage: brandGradients.accent,
              boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
              color: brandColors.textPrimaryLight,
              "&:hover": {
                transform: "translateY(-1px)",
                boxShadow: brandShadows.accentGlow,
              },
            },
            outlined: {
              backgroundColor: alpha(tokens.surfaceSecondary, isDark ? 0.42 : 0.72),
              borderColor: alpha(tokens.outline, isDark ? 0.38 : 0.48),
              "&:hover": {
                backgroundColor: alpha(tokens.surfaceVariant, isDark ? 0.34 : 0.6),
                borderColor: alpha(brandColors.accentStrong, isDark ? 0.42 : 0.3),
              },
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:hover": {
                transform: "translateY(-1px)",
              },
              "&:active": {
                transform: "translateY(0)",
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundColor: alpha(tokens.surface, isDark ? 0.94 : 0.97),
              border: `1px solid ${alpha(tokens.outline, isDark ? 0.2 : 0.15)}`,
              borderRadius: 10,
              boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
              transition: [
                `background-color ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              ].join(", "),
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 999,
              fontWeight: 700,
              height: 22,
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
            },
            label: {
              paddingLeft: 6,
              paddingRight: 6,
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: tokens.surface,
              border: `1px solid ${alpha(tokens.outline, isDark ? 0.22 : 0.18)}`,
              borderRadius: 10,
              boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
            },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              borderColor: alpha(tokens.outline, isDark ? 0.24 : 0.34),
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backgroundColor: alpha(tokens.surface, isDark ? 0.96 : 0.98),
              border: `1px solid ${alpha(tokens.outline, isDark ? 0.22 : 0.18)}`,
              borderRadius: 10,
              boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:hover": {
                transform: "translateX(2px)",
              },
              "&.Mui-focusVisible": {
                boxShadow: `0 0 0 3px ${alpha(brandColors.accent, isDark ? 0.22 : 0.18)}`,
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? alpha(tokens.surfaceSecondary, 0.88) : tokens.surfaceSecondary,
              borderRadius: 10,
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              ].join(", "),
              "& fieldset": {
                borderColor: alpha(tokens.outline, isDark ? 0.32 : 0.54),
              },
              "&:hover fieldset": {
                borderColor: alpha(tokens.outline, isDark ? 0.52 : 0.7),
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 4px ${alpha(brandColors.accent, isDark ? 0.18 : 0.14)}`,
              },
              "&.Mui-focused fieldset": {
                borderColor: brandColors.accent,
              },
            },
            input: {
              paddingBlock: 12,
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
        MuiTableRow: {
          styleOverrides: {
            root: {
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:nth-of-type(even)": {
                backgroundColor: alpha(tokens.surfaceSecondary, isDark ? 0.22 : 0.44),
              },
              "&:hover": {
                backgroundColor: alpha(tokens.surfaceVariant, isDark ? 0.32 : 0.6),
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            body: {
              borderBottomColor: alpha(tokens.outline, isDark ? 0.18 : 0.26),
            },
            head: {
              color: tokens.textPrimary,
              fontWeight: 700,
              borderBottomColor: alpha(tokens.outline, isDark ? 0.22 : 0.32),
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            indicator: {
              backgroundColor: brandColors.accent,
              borderRadius: 999,
              height: 3,
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              transition: [
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:hover": {
                transform: "translateY(-1px)",
              },
              "&.Mui-focusVisible": {
                boxShadow: `0 0 0 3px ${alpha(brandColors.accent, isDark ? 0.22 : 0.16)}`,
              },
            },
          },
        },
      },
    },
    localeThemes[locale],
  );
}
