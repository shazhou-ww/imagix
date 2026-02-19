import type { Event as WorldEvent } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
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
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/api/hooks/useEvents";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { formatEpochMs } from "@/utils/time";

export default function EventListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: events, isLoading } = useEvents(worldId);
  const createEvent = useCreateEvent(worldId!);
  const updateEvent = useUpdateEvent(worldId!);
  const deleteEvent = useDeleteEvent(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WorldEvent | null>(null);
  const [time, setTime] = useState<number>(0);
  const [content, setContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorldEvent | null>(null);

  const sortedEvents = useMemo(
    () => [...(events ?? [])].sort((a, b) => a.time - b.time),
    [events],
  );

  const openCreate = () => {
    setEditingEvent(null);
    setTime(0);
    setContent("");
    setDialogOpen(true);
  };

  const openEdit = (evt: WorldEvent) => {
    setEditingEvent(evt);
    setTime(evt.time);
    setContent(evt.content);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    if (editingEvent) {
      updateEvent.mutate(
        { eventId: editingEvent.id, body: { time, content: content.trim() } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createEvent.mutate(
        { time, content: content.trim() },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEvent.mutate(deleteTarget.id, {
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
        <Typography variant="h4" fontWeight="bold">
          事件时间线
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加事件
        </Button>
      </Box>

      {!sortedEvents.length ? (
        <EmptyState
          title="暂无事件"
          description="添加事件来构建世界的时间线"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加事件
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sortedEvents.map((evt) => (
            <Card key={evt.id}>
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box
                  sx={{
                    minWidth: 140,
                    px: 1.5,
                    py: 0.5,
                    bgcolor: "primary.50",
                    borderRadius: 1,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="body2" fontWeight="bold" color="primary.main">
                    {formatEpochMs(evt.time)}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">{evt.content}</Typography>
                  {evt.participantIds.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      参与者: {evt.participantIds.length} 个实体
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => openEdit(evt)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(evt)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent ? "编辑事件" : "添加事件"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="时间 (毫秒，相对纪元原点)"
            type="number"
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
            helperText={`预览: ${formatEpochMs(time)}`}
            required
          />
          <TextField
            label="事件内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            rows={4}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!content.trim() || createEvent.isPending || updateEvent.isPending}
          >
            {editingEvent ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除事件"
        message="确定要删除此事件吗？关联的状态影响也将失效。"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
