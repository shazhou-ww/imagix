import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import AppLayout from "@/components/AppLayout";
import CallbackPage from "@/pages/CallbackPage";
import CharacterListPage from "@/pages/CharacterListPage";
import EventLinkPage from "@/pages/EventLinkPage";
import EventListPage from "@/pages/EventListPage";
import HomePage from "@/pages/HomePage";
import RelationshipListPage from "@/pages/RelationshipListPage";
import StoryListPage from "@/pages/StoryListPage";
import TaxonomyPage from "@/pages/TaxonomyPage";
import ThingListPage from "@/pages/ThingListPage";
import WorldDashboardPage from "@/pages/WorldDashboardPage";
import WorldListPage from "@/pages/WorldListPage";
import WorldSettingsPage from "@/pages/WorldSettingsPage";

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/worlds" element={<WorldListPage />} />
        <Route path="/worlds/:worldId" element={<WorldDashboardPage />} />
        <Route
          path="/worlds/:worldId/settings"
          element={<WorldSettingsPage />}
        />
        <Route
          path="/worlds/:worldId/taxonomy/:tree"
          element={<TaxonomyPage />}
        />
        <Route
          path="/worlds/:worldId/characters"
          element={<CharacterListPage />}
        />
        <Route path="/worlds/:worldId/things" element={<ThingListPage />} />
        <Route
          path="/worlds/:worldId/relationships"
          element={<RelationshipListPage />}
        />
        <Route path="/worlds/:worldId/events" element={<EventListPage />} />
        <Route
          path="/worlds/:worldId/event-links"
          element={<EventLinkPage />}
        />
        <Route path="/worlds/:worldId/stories" element={<StoryListPage />} />
        <Route path="*" element={<Navigate to="/worlds" replace />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  const { authState } = useAuth();

  if (authState.status === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/callback" element={<CallbackPage />} />
      {authState.status === "authenticated" ? (
        <Route path="/*" element={<AuthenticatedRoutes />} />
      ) : (
        <Route path="*" element={<HomePage />} />
      )}
    </Routes>
  );
}

export default App;
