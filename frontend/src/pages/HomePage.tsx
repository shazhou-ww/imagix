import { Box, Button, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box
      sx={{
        py: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Typography variant="h2" component="h1" fontWeight="bold">
        Imagix
      </Typography>
      <Typography variant="h5" color="text.secondary">
        AI Story Generator
      </Typography>
      <Button variant="contained" size="large">
        Get Started
      </Button>
    </Box>
  );
}
