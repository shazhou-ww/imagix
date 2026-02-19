import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import LinkIcon from "@mui/icons-material/Link";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useWorld } from "@/api/hooks/useWorlds";

const statCards = [
  { label: "角色", icon: <PersonIcon />, color: "#B48EAD" },
  { label: "事物", icon: <PlaceIcon />, color: "#88C0D0" },
  { label: "关系", icon: <LinkIcon />, color: "#A3D9A5" },
  { label: "事件", icon: <TimelineIcon />, color: "#EBCB8B" },
  { label: "故事", icon: <AutoStoriesIcon />, color: "#E8A0BF" },
];

export default function WorldDashboardPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: world, isLoading } = useWorld(worldId);

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
              <CardContent sx={{ textAlign: "center" }}>
                <Box sx={{ color: card.color, mb: 1 }}>{card.icon}</Box>
                <Typography variant="h5" fontWeight="bold">
                  —
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
