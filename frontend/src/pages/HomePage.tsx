import { Box, Button, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { authState, signInWithGoogle, signOut, isConfigured } = useAuth();

  if (authState.status === "loading") {
    return (
      <Box
        sx={{
          py: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography color="text.secondary">Loading...</Typography>
      </Box>
    );
  }

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

      {authState.status === "authenticated" ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography color="text.secondary">
            Signed in as {authState.user.username ?? authState.user.userId}
          </Typography>
          <Button variant="outlined" onClick={() => signOut()}>
            Sign out
          </Button>
        </Box>
      ) : isConfigured ? (
        <Button
          variant="contained"
          size="large"
          onClick={() => signInWithGoogle()}
        >
          Sign in with Google
        </Button>
      ) : (
        <Typography color="text.secondary" variant="body2">
          Configure .env with Cognito credentials to enable Google sign-in.
        </Typography>
      )}
    </Box>
  );
}
