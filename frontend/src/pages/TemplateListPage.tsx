import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PublicIcon from "@mui/icons-material/Public";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCreateTemplate,
  useCreateWorldFromTemplate,
  useDeleteTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/api/hooks/useTemplates";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

export default function TemplateListPage() {
  const navigate = useNavigate();
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createWorldId, setCreateWorldId] = useState<string | null>(null);

  // Create template form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Edit template form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Create world from template form
  const [worldName, setWorldName] = useState("");
  const [worldDesc, setWorldDesc] = useState("");
  const [worldEpoch, setWorldEpoch] = useState("");

  const createWorldFromTemplate = useCreateWorldFromTemplate();

  const handleCreate = () => {
    if (!name.trim()) return;
    createTemplate.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName("");
          setDescription("");
        },
      },
    );
  };

  const handleEdit = (id: string) => {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setEditId(id);
    setEditName(tpl.name);
    setEditDesc(tpl.description);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTemplate.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  };

  const handleCreateWorld = () => {
    if (!createWorldId) return;
    createWorldFromTemplate.mutate(
      {
        templateId: createWorldId,
        body: {
          name: worldName.trim() || undefined,
          description: worldDesc.trim() || undefined,
          epoch: worldEpoch.trim() || undefined,
        },
      },
      {
        onSuccess: (world) => {
          setCreateWorldId(null);
          setWorldName("");
          setWorldDesc("");
          setWorldEpoch("");
          navigate(`/worlds/${world.id}`);
        },
      },
    );
  };

  const openCreateWorld = (id: string) => {
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    setCreateWorldId(id);
    setWorldName(tpl.snapshot.world.name);
    setWorldDesc(tpl.snapshot.world.description);
    setWorldEpoch(tpl.snapshot.world.epoch);
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
          世界模板
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          创建模板
        </Button>
      </Box>

      {!templates?.length ? (
        <EmptyState
          title="还没有模板"
          description="你可以创建空模板，或从已有世界保存为模板"
          action={
            <Button variant="outlined" onClick={() => setCreateOpen(true)}>
              创建模板
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {templates.map((tpl) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tpl.id}>
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {tpl.name}
                    </Typography>
                    <Box
                      sx={{ display: "flex", gap: 0.5, ml: 1, flexShrink: 0 }}
                    >
                      <Tooltip title="编辑模板">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(tpl.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除模板">
                        <IconButton
                          size="small"
                          onClick={() => setDeleteId(tpl.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {tpl.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        mb: 1,
                      }}
                    >
                      {tpl.description}
                    </Typography>
                  )}
                  <Box
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      分类节点: {tpl.snapshot.taxonomy.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      属性定义: {tpl.snapshot.attributeDefinitions.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      地点: {tpl.snapshot.places.length}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PublicIcon />}
                    onClick={() => openCreateWorld(tpl.id)}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    从模板创建世界
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Template Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建模板</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="模板名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="模板描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || createTemplate.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Template Dialog */}
      {editId && (
        <EditTemplateDialog
          templateId={editId}
          name={editName}
          description={editDesc}
          onNameChange={setEditName}
          onDescChange={setEditDesc}
          onClose={() => setEditId(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="删除模板"
        message="确定要删除此模板吗？此操作不可撤销。"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Create World from Template Dialog */}
      <Dialog
        open={!!createWorldId}
        onClose={() => setCreateWorldId(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>从模板创建世界</DialogTitle>
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
            value={worldName}
            onChange={(e) => setWorldName(e.target.value)}
            autoFocus
            helperText="不填则使用模板中的名称"
          />
          <TextField
            label="世界描述"
            value={worldDesc}
            onChange={(e) => setWorldDesc(e.target.value)}
            multiline
            rows={3}
          />
          <TextField
            label="纪元描述"
            value={worldEpoch}
            onChange={(e) => setWorldEpoch(e.target.value)}
            helperText="定义世界的时间原点（t=0），不填则使用模板中的纪元"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateWorldId(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreateWorld}
            disabled={createWorldFromTemplate.isPending}
          >
            创建世界
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Edit template dialog
// ---------------------------------------------------------------------------

function EditTemplateDialog({
  templateId,
  name,
  description,
  onNameChange,
  onDescChange,
  onClose,
}: {
  templateId: string;
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onClose: () => void;
}) {
  const updateTemplate = useUpdateTemplate(templateId);
  const handleSave = () => {
    updateTemplate.mutate(
      {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑模板</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "8px !important",
        }}
      >
        <TextField
          label="模板名称"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
        />
        <TextField
          label="模板描述"
          value={description}
          onChange={(e) => onDescChange(e.target.value)}
          multiline
          rows={3}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateTemplate.isPending}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
