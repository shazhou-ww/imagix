import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import {
  useTemplates,
  useDeleteTemplate,
  useUpdateTemplate,
} from "@/api/hooks/useTemplates";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

export default function UserSettingsPage() {
  const { authState, signOut } = useAuth();
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit template form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

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

  const username =
    authState.status === "authenticated"
      ? authState.displayName
      : "";

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        用户设置
      </Typography>

      {/* User info */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
          {username[0]?.toUpperCase() ?? "U"}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {username}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            已登录
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={() => signOut()}
          size="small"
        >
          退出登录
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Templates section */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
        世界模板
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        在世界设定页面可将已有世界保存为模板。创建新世界时可以选择模板快速开始。
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !templates?.length ? (
        <EmptyState
          title="还没有模板"
          description="在世界设定中将已有世界保存为模板，创建新世界时即可选择模板快速开始"
        />
      ) : (
        <Grid container spacing={2}>
          {templates.map((tpl) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tpl.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {tpl.name}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, ml: 1, flexShrink: 0 }}>
                      <Tooltip title="编辑模板">
                        <IconButton size="small" onClick={() => handleEdit(tpl.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除模板">
                        <IconButton size="small" onClick={() => setDeleteId(tpl.id)}>
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
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
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
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

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
    </Box>
  );
}

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
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
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
        <Button variant="contained" onClick={handleSave} disabled={updateTemplate.isPending}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
