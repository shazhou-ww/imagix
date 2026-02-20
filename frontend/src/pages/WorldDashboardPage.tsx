import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import LinkIcon from "@mui/icons-material/Link";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useWorld } from "@/api/hooks/useWorlds";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useThings } from "@/api/hooks/useThings";
import { useRelationships } from "@/api/hooks/useRelationships";
import { useEvents } from "@/api/hooks/useEvents";
import { useStories } from "@/api/hooks/useStories";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import { useAttributeDefinitions } from "@/api/hooks/useAttributeDefinitions";

const statCards = [
  { label: "分类体系", icon: <AccountTreeIcon />, color: "#5E81AC", path: "taxonomy/CHAR" },
  { label: "属性词典", icon: <AssignmentIcon />, color: "#81A1C1", path: "attributes" },
  { label: "角色", icon: <PersonIcon />, color: "#B48EAD", path: "characters" },
  { label: "事物", icon: <PlaceIcon />, color: "#88C0D0", path: "things" },
  { label: "关系", icon: <LinkIcon />, color: "#A3D9A5", path: "relationships" },
  { label: "事件", icon: <TimelineIcon />, color: "#EBCB8B", path: "events" },
  { label: "故事", icon: <AutoStoriesIcon />, color: "#E8A0BF", path: "stories" },
];

export default function WorldDashboardPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: world, isLoading } = useWorld(worldId);
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const { data: relationships } = useRelationships(worldId);
  const { data: events } = useEvents(worldId);
  const { data: stories } = useStories(worldId);
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const { data: thingNodes } = useTaxonomyTree(worldId, "THING");
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const { data: attrDefs } = useAttributeDefinitions(worldId);

  const taxonomyTotal = (charNodes?.length ?? 0) + (thingNodes?.length ?? 0) + (relNodes?.length ?? 0);

  const counts: Record<string, number | undefined> = {
    分类体系: taxonomyTotal,
    属性词典: attrDefs?.length,
    角色: characters?.length,
    事物: things?.length,
    关系: relationships?.length,
    事件: events?.length,
    故事: stories?.length,
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!world) {
    return <Typography color="error">世界不存在</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {world.name}
      </Typography>
      {world.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {world.description}
        </Typography>
      )}

      <Grid container spacing={2}>
        {statCards.map((card) => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={card.label}>
            <Card>
              <CardActionArea onClick={() => navigate(`/worlds/${worldId}/${card.path}`)}>
                <CardContent sx={{ textAlign: "center" }}>
                  <Box sx={{ color: card.color, mb: 1 }}>{card.icon}</Box>
                  <Typography variant="h5" fontWeight="bold">
                    {counts[card.label] ?? "—"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
