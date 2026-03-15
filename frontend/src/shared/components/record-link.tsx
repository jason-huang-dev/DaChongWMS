import type { ReactNode } from "react";

import { Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface RecordLinkProps {
  to: string;
  children: ReactNode;
}

export function RecordLink({ to, children }: RecordLinkProps) {
  return (
    <Link component={RouterLink} to={to} underline="hover" variant="body2">
      {children}
    </Link>
  );
}
