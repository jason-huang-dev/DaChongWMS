import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";

import { useI18n, useUiPreferences } from "@/app/ui-preferences";

interface UiPreferencesControlsProps {
  compact?: boolean;
}

export function UiPreferencesControls({ compact = false }: UiPreferencesControlsProps) {
  const { locale, setLocale, themeMode, setThemeMode } = useUiPreferences();
  const { t } = useI18n();

  return (
    <Stack alignItems="center" direction="row" spacing={compact ? 0.5 : 1}>
      <Tooltip title={t("ui.toggleTheme")}>
        <IconButton
          aria-label={t("ui.toggleTheme")}
          color="inherit"
          onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
          size={compact ? "small" : "medium"}
          sx={
            compact
              ? {
                  height: 24,
                  p: 0.375,
                  width: 24,
                }
              : undefined
          }
        >
          {themeMode === "light" ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <TextField
        aria-label={t("ui.language")}
        onChange={(event) => setLocale(event.target.value as "en" | "zh-CN")}
        select
        size="small"
        sx={{
          minWidth: compact ? 92 : 132,
          ...(compact
            ? {
                "& .MuiInputBase-root": {
                  fontSize: 11,
                  height: 24,
                },
                "& .MuiSelect-select": {
                  alignItems: "center",
                  display: "flex",
                  py: 0,
                },
              }
            : undefined),
        }}
        value={locale}
      >
        <MenuItem value="en">{t("ui.english")}</MenuItem>
        <MenuItem value="zh-CN">{t("ui.chineseSimplified")}</MenuItem>
      </TextField>
    </Stack>
  );
}
