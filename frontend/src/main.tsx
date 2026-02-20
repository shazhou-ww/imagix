import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { configureAmplify } from "./config/amplify";
import { theme } from "./theme";

const isAmplifyConfigured = configureAmplify();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

// Intercept MUI Modal's aria-hidden on #root and replace with inert attribute.
// MUI sets aria-hidden="true" on #root when a Dialog/Modal opens (portal renders
// outside #root). This causes a Chrome warning when a button inside #root still
// has focus. The inert attribute is the recommended replacement — it both hides
// content from assistive technology AND auto-blurs focused descendants.
const origSetAttribute = rootEl.setAttribute.bind(rootEl);
const origRemoveAttribute = rootEl.removeAttribute.bind(rootEl);
rootEl.setAttribute = (name: string, value: string) => {
  if (name === "aria-hidden") {
    value === "true"
      ? origSetAttribute("inert", "")
      : origRemoveAttribute("inert");
    return;
  }
  origSetAttribute(name, value);
};
rootEl.removeAttribute = (name: string) => {
  if (name === "aria-hidden") {
    origRemoveAttribute("inert");
    return;
  }
  origRemoveAttribute(name);
};

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider isConfigured={isAmplifyConfigured}>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
