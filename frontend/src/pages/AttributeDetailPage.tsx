import type { AttributeDefinition } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  useAttributeDefinitions,
  useDeleteAttributeDefinition,
  useUpdateAttributeDefinition,
} from "@/api/hooks/useAttributeDefinitions";
import { useEvents } from "@/api/hooks/useEvents";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";
import { formatEpochMs } from "@/utils/time";

const TYPE_LABELS: Record<string, string> = {
  string: "文本",
  number: "数值",
  boolean: "布尔",
  enum: "枚举",
  timestamp: "时间戳",
  timespan: "时间跨度",
};

export default function AttributeDetailPage() {
  const { worldId, adfId } = useParams<{
    worldId: string;
    adfId: string;
  }>();
  const navigate = useNavigate();

  const { data: definitions, isLoading } = useAttributeDefinitions(worldId);
  const { data: events } = useEvents(worldId);
  const updateAttr = useUpdateAttributeDefinition(worldId ?? "");
  const deleteAttr = useDeleteAttributeDefinition(worldId ?? "");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editEnumValues, setEditEnumValues] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  const attr = useMemo(
    () => definitions?.find((d) => d.id === adfId),
    [definitions, adfId],
  );

  // Events that impact this attribute
  const relatedEvents = useMemo(() => {
    if (!attr || !events) return [];
    return events
      .filter(
        (evt) =>
          evt.impacts?.attributeChanges?.some(
            (ac) => ac.attribute === attr.name,
          ) ||
          evt.impacts?.relationshipAttributeChanges?.some(
            (rac) => rac.attribute === attr.name,
          ),
      )
      .sort((a, b) => a.time - b.time);
  }, [attr, events]);

  if (!worldId || !adfId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!attr) {
    return <Navigate to={`/worlds/${worldId}/attributes`} replace />;
  }

  const isSystem = attr.system;

  const openEdit = () => {
    setEditName(attr.name);
    setEditType(attr.type);
    setEditEnumValues(attr.enumValues?.join(", ") ?? "");
    setEditDesc(attr.description ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updateAttr.mutate(
      {
        adfId: attr.id,
        body: {
          name: editName.trim(),
          type: editType as AttributeDefinition["type"],
          enumValues:
            editType === "enum"
              ? editEnumValues
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean)
              : undefined,
          description: editDesc.trim() || undefined,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    deleteAttr.mutate(attr.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/attributes`),
    });
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "属性定义", to: `/worlds/${worldId}/attributes` },
          { label: attr.name },
        ]}
        title={attr.name}
        subtitle={TYPE_LABELS[attr.type] ?? attr.type}
        status={
          isSystem
            ? { label: "系统", color: "info" }
            : { label: "自定义", color: "default" }
        }
        actions={
          !isSystem ? (
            <>
              <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
                编辑
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteOpen(true)}
              >
                删除
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Basic Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          基本信息
        </Typography>
        {!isSystem ? (
          <>
            <EditableField
              label="名称"
              value={attr.name}
              onSave={(v) =>
                updateAttr.mutate({
                  adfId: attr.id,
                  body: { name: v },
                })
              }
              required
              saving={updateAttr.isPending}
            />
            <EditableField
              label="描述"
              value={attr.description ?? ""}
              onSave={(v) =>
                updateAttr.mutate({
                  adfId: attr.id,
                  body: { description: v || undefined },
                })
              }
              multiline
              rows={2}
              placeholder="暂无描述"
              saving={updateAttr.isPending}
            />
          </>
        ) : (
          <>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                名称
              </Typography>
              <Typography variant="body1">{attr.name}</Typography>
            </Box>
            {attr.description && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  描述
                </Typography>
                <Typography variant="body2">{attr.description}</Typography>
              </Box>
            )}
          </>
        )}
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            类型
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip
              label={TYPE_LABELS[attr.type] ?? attr.type}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>
        {attr.type === "enum" && attr.enumValues && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              枚举值
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                flexWrap: "wrap",
                mt: 0.5,
              }}
            >
              {attr.enumValues.map((v) => (
                <Chip
                  key={v}
                  label={v}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.75rem" }}
                />
              ))}
            </Box>
          </Box>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          ID: {attr.id}
        </Typography>
      </Paper>

      {/* Related Events */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          引用此属性的事件（{relatedEvents.length}）
        </Typography>
        {relatedEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无事件引用此属性
          </Typography>
        ) : (
          <List dense disablePadding>
            {relatedEvents.map((evt) => (
              <ListItemButton
                key={evt.id}
                onClick={() => navigate(`/worlds/${worldId}/events/${evt.id}`)}
              >
                <ListItemText
                  primary={evt.content || evt.id}
                  secondary={formatEpochMs(evt.time)}
                />
                {evt.system && (
                  <Chip
                    label="系统"
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </Paper>

      {/* Edit Dialog */}
      {!isSystem && (
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>编辑属性定义</DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: "8px !important",
            }}
          >
            <TextField
              label="属性名称"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              required
            />
            <TextField
              label="属性类型"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              select
              required
              slotProps={{ inputLabel: { htmlFor: undefined } }}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            {editType === "enum" && (
              <TextField
                label="枚举值（逗号分隔）"
                value={editEnumValues}
                onChange={(e) => setEditEnumValues(e.target.value)}
                helperText="用英文逗号分隔各个枚举值"
              />
            )}
            <TextField
              label="描述（可选）"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              disabled={!editName.trim() || !editType || updateAttr.isPending}
            >
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirm */}
      {!isSystem && (
        <ConfirmDialog
          open={deleteOpen}
          title="删除属性定义"
          message={`确定要删除属性「${attr.name}」吗？`}
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
          loading={deleteAttr.isPending}
        />
      )}
    </Box>
  );
}
