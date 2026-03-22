import type { ReactNode } from "react";

import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {
  Box,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";

interface DashboardQueueMetric {
  label: string;
  value: ReactNode;
  to?: string;
}

interface DashboardQueueCardProps {
  title: string;
  subtitle?: string;
  metrics: DashboardQueueMetric[];
}

export function DashboardQueueCard({ title, subtitle, metrics }: DashboardQueueCardProps) {
  const { translateText } = useI18n();

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%" }}>
        <Stack spacing={2.5} sx={{ height: "100%" }}>
          <Box>
            <Typography variant="h6">{translateText(title)}</Typography>
            {subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {translateText(subtitle)}
              </Typography>
            ) : null}
          </Box>
          <Stack spacing={1.25}>
            {metrics.map((metric) => {
              const content = (
                <Stack
                  alignItems="center"
                  direction="row"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{ minHeight: 40 }}
                >
                  <Typography color="text.secondary" variant="body2">
                    {translateText(metric.label)}
                  </Typography>
                  <Stack alignItems="center" direction="row" spacing={0.75}>
                    <Typography sx={{ fontWeight: 600 }} variant="h6">
                      {metric.value}
                    </Typography>
                    {metric.to ? <ChevronRightRoundedIcon color="action" fontSize="small" /> : null}
                  </Stack>
                </Stack>
              );

              return metric.to ? (
                <Link
                  color="inherit"
                  component={RouterLink}
                  key={metric.label}
                  sx={{
                    borderRadius: 2,
                    display: "block",
                    px: 1.25,
                    py: 0.25,
                    textDecoration: "none",
                    transition: "background-color 120ms ease",
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                  to={metric.to}
                  underline="none"
                >
                  {content}
                </Link>
              ) : (
                <Box
                  key={metric.label}
                  sx={{
                    borderRadius: 2,
                    px: 1.25,
                    py: 0.25,
                  }}
                >
                  {content}
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
