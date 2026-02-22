import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { useWorlds } from "@/api/hooks/useWorlds";
import { useAuth } from "@/auth/AuthContext";
import AppLayout from "@/components/AppLayout";
import EmptyState from "@/components/EmptyState";
import AttributeDefinitionPage from "@/pages/AttributeDefinitionPage";
import AttributeDetailPage from "@/pages/AttributeDetailPage";
import CallbackPage from "@/pages/CallbackPage";
import CharacterDetailPage from "@/pages/CharacterDetailPage";
import CharacterListPage from "@/pages/CharacterListPage";
import EventDetailPage from "@/pages/EventDetailPage";
import EventLinkPage from "@/pages/EventLinkPage";
import EventListPage from "@/pages/EventListPage";
import HomePage from "@/pages/HomePage";
import PlaceDetailPage from "@/pages/PlaceDetailPage";
import PlaceListPage from "@/pages/PlaceListPage";
import RelationshipDetailPage from "@/pages/RelationshipDetailPage";
import RelationshipListPage from "@/pages/RelationshipListPage";
import StoryDetailPage from "@/pages/StoryDetailPage";
import StoryListPage from "@/pages/StoryListPage";
import TaxonomyNodeDetailPage from "@/pages/TaxonomyNodeDetailPage";
import TaxonomyPage from "@/pages/TaxonomyPage";
import ThingDetailPage from "@/pages/ThingDetailPage";
import ThingListPage from "@/pages/ThingListPage";
import UserSettingsPage from "@/pages/UserSettingsPage";
import WorldDashboardPage from "@/pages/WorldDashboardPage";
import WorldSettingsPage from "@/pages/WorldSettingsPage";

/** Redirect to the first world's dashboard, or show empty state */
function DefaultRedirect() {
  const { data: worlds, isLoading } = useWorlds();
  if (isLoading) return <CircularProgress />;
  if (worlds?.length)
    return <Navigate to={`/worlds/${worlds[0].id}`} replace />;
  return (
    <EmptyState
      title="还没有世界"
      description="点击左侧「创建世界」按钮，开始构建你的故事世界"
    />
  );
}

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Routes>
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
          path="/worlds/:worldId/taxonomy/:tree/:nodeId"
          element={<TaxonomyNodeDetailPage />}
        />
        <Route
          path="/worlds/:worldId/attributes"
          element={<AttributeDefinitionPage />}
        />
        <Route
          path="/worlds/:worldId/attributes/:adfId"
          element={<AttributeDetailPage />}
        />
        <Route
          path="/worlds/:worldId/characters"
          element={<CharacterListPage />}
        />
        <Route
          path="/worlds/:worldId/characters/:charId"
          element={<CharacterDetailPage />}
        />
        <Route path="/worlds/:worldId/things" element={<ThingListPage />} />
        <Route
          path="/worlds/:worldId/things/:thingId"
          element={<ThingDetailPage />}
        />
        <Route path="/worlds/:worldId/places" element={<PlaceListPage />} />
        <Route
          path="/worlds/:worldId/places/:placeId"
          element={<PlaceDetailPage />}
        />
        <Route
          path="/worlds/:worldId/relationships"
          element={<RelationshipListPage />}
        />
        <Route
          path="/worlds/:worldId/relationships/:relId"
          element={<RelationshipDetailPage />}
        />
        <Route path="/worlds/:worldId/events" element={<EventListPage />} />
        <Route
          path="/worlds/:worldId/events/:eventId"
          element={<EventDetailPage />}
        />
        <Route
          path="/worlds/:worldId/event-links"
          element={<EventLinkPage />}
        />
        <Route path="/worlds/:worldId/stories" element={<StoryListPage />} />
        <Route
          path="/worlds/:worldId/stories/:storyId"
          element={<StoryDetailPage />}
        />
        <Route path="/settings" element={<UserSettingsPage />} />
        <Route path="*" element={<DefaultRedirect />} />
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
