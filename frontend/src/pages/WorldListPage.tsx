import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreateWorld, useWorlds } from "@/api/hooks/useWorlds";
import EmptyState from "@/components/EmptyState";

export default function WorldListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: worlds, isLoading } = useWorlds();
  const createWorld = useCreateWorld();
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("create") === "1");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [epoch, setEpoch] = useState("");

  const closeDialog = () => {
    setDialogOpen(false);
    // Clean up query param
    if (searchParams.has("create")) {
      searchParams.delete("create");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !epoch.trim()) return;
    createWorld.mutate(
      { name: name.trim(), description: description.trim() || undefined, epoch: epoch.trim() },
      {
        onSuccess: (world) => {
          closeDialog();
          setName("");
          setDescription("");
          setEpoch("");
          navigate(`/worlds/${world.id}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          我的世界
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          创建世界
        </Button>
      </Box>

      {!worlds?.length ? (
        <EmptyState
          title="还没有世界"
          description="创建你的第一个故事世界，开始构建角色、事件和故事"
          action={
            <Button variant="outlined" onClick={() => setDialogOpen(true)}>
              创建世界
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {worlds.map((world) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={world.id}>
              <Card>
                <CardActionArea onClick={() => navigate(`/worlds/${world.id}`)}>
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {world.name}
                    </Typography>
                    {world.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {world.description}
                      </Typography>
                    )}
                    {world.epoch && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: "block" }}
                      >
                        纪元: {world.epoch}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create World Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建世界</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="世界名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="世界描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
          <TextField
            label="纪元描述"
            value={epoch}
            onChange={(e) => setEpoch(e.target.value)}
            required
            helperText="定义世界的时间原点（t=0），如「盘古开天辟地」。创建后会自动生成纪元事件。"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || !epoch.trim() || createWorld.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
