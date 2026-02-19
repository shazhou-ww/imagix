import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { theme } from "./theme";

describe("App", () => {
  it("renders Imagix title", () => {
    render(
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <AuthProvider isConfigured={false}>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText("Imagix")).toBeDefined();
  });
});
