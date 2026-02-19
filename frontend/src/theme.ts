import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#B48EAD",
      light: "#D4B8CC",
      dark: "#956B8A",
    },
    secondary: {
      main: "#88C0D0",
      light: "#A9D4E0",
      dark: "#6BA3B5",
    },
    success: {
      main: "#A3D9A5",
    },
    warning: {
      main: "#EBCB8B",
    },
    error: {
      main: "#E8A0BF",
    },
    background: {
      default: "#FDF6F0",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#4A4458",
      secondary: "#8E8C99",
    },
    divider: "#E8E0D8",
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans SC", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(74, 68, 88, 0.08)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: "0 2px 8px rgba(74, 68, 88, 0.08)",
        },
      },
    },
  },
});
