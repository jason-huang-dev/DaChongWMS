import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import { Alert, Button, Card, CardContent, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";

export function RecoveryCodesCard({ recoveryCodes }: { recoveryCodes: string[] }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <div>
              <Typography variant="h6">Recovery codes</Typography>
              <Typography color="text.secondary" variant="body2">
                Store these one-time codes in a secure place. Each code can be used once if the authenticator app is unavailable.
              </Typography>
            </div>
            <Button onClick={handleCopy} startIcon={<ContentCopyOutlinedIcon />} variant="outlined">
              Copy
            </Button>
          </Stack>
          <Alert severity="warning">Recovery codes are only shown once after enrollment verification.</Alert>
          <List dense sx={{ bgcolor: "background.default", borderRadius: 2 }}>
            {recoveryCodes.map((code) => (
              <ListItem key={code} divider>
                <ListItemText primary={code} />
              </ListItem>
            ))}
          </List>
        </Stack>
      </CardContent>
    </Card>
  );
}
