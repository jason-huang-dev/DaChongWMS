import { Box } from "@mui/material";

interface JsonBlockProps {
  value: unknown;
  emptyMessage?: string;
}

export function JsonBlock({ value, emptyMessage = "{}" }: JsonBlockProps) {
  const formattedValue =
    value === null || value === undefined
      ? emptyMessage
      : JSON.stringify(value, null, 2);

  return (
    <Box
      component="pre"
      sx={{
        backgroundColor: "grey.100",
        borderRadius: 1.5,
        fontFamily: "monospace",
        fontSize: "0.8125rem",
        m: 0,
        overflowX: "auto",
        p: 2,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {formattedValue}
    </Box>
  );
}
