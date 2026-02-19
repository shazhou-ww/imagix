import InboxIcon from "@mui/icons-material/Inbox";
import { Box, type SxProps, Typography } from "@mui/material";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  sx?: SxProps;
}

export default function EmptyState({
  title,
  description,
  action,
  sx,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        gap: 2,
        ...sx,
      }}
    >
      <InboxIcon sx={{ fontSize: 64, color: "text.secondary", opacity: 0.4 }} />
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
