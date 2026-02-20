import type { AttributeDefinition } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useAttributeDefinitions,
  useCreateAttributeDefinition,
  useUpdateAttributeDefinition,
  useDeleteAttributeDefinition,
} from "@/api/hooks/useAttributeDefinitions";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "string", label: "文本" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔" },
  { value: "enum", label: "枚举" },
];

const TYPE_LABELS: Record<string, string> = {
  string: "文本",
  number: "数字",
  boolean: "布尔",
  enum: "枚举",
};

export default function AttributeDefinitionPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: attrs, isLoading } = useAttributeDefinitions(worldId);
  const createAttr = useCreateAttributeDefinition(worldId!);
  const updateAttr = useUpdateAttributeDefinition(worldId!);
  const deleteAttr = useDeleteAttributeDefinition(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AttributeDefinition | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("string");
  const [description, setDescription] = useState("");
  const [enumValues, setEnumValues] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AttributeDefinition | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setType("string");
    setDescription("");
    setEnumValues("");
    setDialogOpen(true);
  };

  const openEdit = (attr: AttributeDefinition) => {
    setEditing(attr);
    setName(attr.name);
    setType(attr.type);
    setDescription(attr.description ?? "");
    setEnumValues((attr.enumValues ?? []).join(", "));
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const body: any = {
      name: name.trim(),
      type,
      description: description.trim() || undefined,
    };
    if (type === "enum") {
      const vals = enumValues
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (vals.length > 0) body.enumValues = vals;
    }

    if (editing) {
      updateAttr.mutate(
        { adfId: editing.id, body },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createAttr.mutate(body, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteAttr.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            属性词典
          </Typography>
          <Typography variant="body2" color="text.secondary">
            定义世界中的属性术语，统一角色、事物、关系的属性命名与类型
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加属性
        </Button>
      </Box>

      {!attrs?.length ? (
        <EmptyState
          title="暂无属性定义"
          description="添加属性定义来统一世界中的术语，如「修为境界」「灵根」「攻击力」等"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加属性
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {attrs.map((attr) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={attr.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                      {attr.name}
                    </Typography>
                    <Chip
                      label={TYPE_LABELS[attr.type] ?? attr.type}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 22, fontSize: "0.75rem", mr: 0.5 }}
                    />
                    <Tooltip title="编辑">
                      <IconButton size="small" onClick={() => openEdit(attr)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(attr)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {attr.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {attr.description}
                    </Typography>
                  )}
                  {attr.type === "enum" && attr.enumValues && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {attr.enumValues.map((v) => (
                        <Chip key={v} label={v} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.75rem" }} />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "编辑属性" : "添加属性"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="属性名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            placeholder="如：修为境界、灵根、攻击力"
          />
          <TextField
            label="类型"
            value={type}
            onChange={(e) => setType(e.target.value)}
            select
            required
          >
            {TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          {type === "enum" && (
            <TextField
              label="枚举可选值"
              value={enumValues}
              onChange={(e) => setEnumValues(e.target.value)}
              placeholder="逗号分隔，如：金, 木, 水, 火, 土"
              helperText="多个值用逗号分隔"
            />
          )}
          <TextField
            label="说明 (可选)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!name.trim() || createAttr.isPending || updateAttr.isPending}
          >
            {editing ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除属性定义"
        message={`确定要删除「${deleteTarget?.name}」吗？已使用此属性的事件数据不会被影响。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
