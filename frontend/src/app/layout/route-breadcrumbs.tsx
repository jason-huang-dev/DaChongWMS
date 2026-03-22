import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink, useMatches } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";

interface RouteHandle {
  crumb?: string;
}

export function RouteBreadcrumbs() {
  const { translateText } = useI18n();
  const matches = useMatches();
  const crumbs = matches
    .map((match) => ({
      handle: match.handle as RouteHandle | undefined,
      pathname: match.pathname,
    }))
    .filter((match) => Boolean(match.handle?.crumb));

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs aria-label="breadcrumb" separator={<NavigateNextIcon fontSize="small" />}>
      {crumbs.map((crumb, index) => {
        const label = translateText(crumb.handle?.crumb ?? "");
        const isLast = index === crumbs.length - 1;
        if (isLast) {
          return (
            <Typography color="text.primary" key={crumb.pathname} variant="body2">
              {label}
            </Typography>
          );
        }
        return (
          <Link component={RouterLink} key={crumb.pathname} to={crumb.pathname} underline="hover" variant="body2">
            {label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
