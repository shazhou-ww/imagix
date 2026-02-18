import { Routes, Route } from "react-router-dom";
import { Box, Container } from "@mui/material";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;
