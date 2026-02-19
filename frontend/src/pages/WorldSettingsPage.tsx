import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useWorld, useUpdateWorld } from "@/api/hooks/useWorlds";

export default function WorldSettingsPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: world, isLoading } = useWorld(worldId);
  const updateWorld = useUpdateWorld(worldId!);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState("");
  const [epoch, setEpoch] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (world) {
      setName(world.name);
      setDescription(world.description);
      setSettings(world.settings);
      setEpoch(world.epoch);
    }
  }, [world]);

  const handleSave = () => {
    if (!name.trim()) return;
    updateWorld.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        settings: settings.trim() || undefined,
        epoch: epoch.trim() || undefined,
      },
      { onSuccess: () => setSaved(true) },
    );
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
        世界设定
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 600 }}>
        <TextField
          label="世界名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="世界观描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={3}
        />
        <TextField
          label="世界设定"
          value={settings}
          onChange={(e) => setSettings(e.target.value)}
          multiline
          rows={6}
          helperText="物理法则、力量体系、社会规则等"
        />
        <TextField
          label="时间纪元"
          value={epoch}
          onChange={(e) => setEpoch(e.target.value)}
          helperText='对 t=0 原点的文字说明，如"盘古开天辟地"'
        />
        <Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!name.trim() || updateWorld.isPending}
          >
            保存设定
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSaved(false)}>
          世界设定已保存
        </Alert>
      </Snackbar>
    </Box>
  );
}
