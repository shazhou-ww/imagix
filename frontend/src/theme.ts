import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7c3aed",
    },
    secondary: {
      main: "#06b6d4",
    },
    background: {
      default: "#0f0a1e",
      paper: "#1a1333",
    },
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Inter", sans-serif',
  },
});
