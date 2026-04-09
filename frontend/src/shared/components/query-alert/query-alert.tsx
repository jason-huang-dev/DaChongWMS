import { Alert } from "@mui/material";

interface QueryAlertProps {
  message?: string | null;
}

export function QueryAlert({ message }: QueryAlertProps) {
  if (!message) {
    return null;
  }
  return <Alert severity="error">{message}</Alert>;
}
