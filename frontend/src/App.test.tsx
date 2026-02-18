import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "./theme";
import App from "./App";

describe("App", () => {
  it("renders Imagix title", () => {
    render(
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>,
    );
    expect(screen.getByText("Imagix")).toBeDefined();
  });
});
