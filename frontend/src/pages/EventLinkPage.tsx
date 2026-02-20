import type { EventLink, Event as WorldEvent } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
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
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useEventLinks,
  useCreateEventLink,
  useDeleteEventLink,
} from "@/api/hooks/useEventLinks";
import { useEvents } from "@/api/hooks/useEvents";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { formatEpochMs } from "@/utils/time";

export default function EventLinkPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: links, isLoading } = useEventLinks(worldId);
  const { data: events } = useEvents(worldId);
  const createLink = useCreateEventLink(worldId!);
  const deleteLink = useDeleteEventLink(worldId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventIdA, setEventIdA] = useState("");
  const [eventIdB, setEventIdB] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EventLink | null>(null);

  const eventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const e of events ?? []) map.set(e.id, e);
    return map;
  }, [events]);

  const eventLabel = (id: string) => {
    const evt = eventMap.get(id);
    if (!evt) return id;
    const timeStr = formatEpochMs(evt.time);
    const content = evt.content.length > 30 ? `${evt.content.slice(0, 30)}…` : evt.content;
    return `${timeStr} — ${content}`;
  };

  const openCreate = () => {
    setEventIdA("");
    setEventIdB("");
    setDescription("");
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!eventIdA || !eventIdB) return;
    createLink.mutate(
      {
        eventIdA,
        eventIdB,
        description: description.trim() || undefined,
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteLink.mutate(
      { eventIdA: deleteTarget.eventIdA, eventIdB: deleteTarget.eventIdB },
      { onSuccess: () => setDeleteTarget(null) },
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          事件关联
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加关联
        </Button>
      </Box>

      {!links?.length ? (
        <EmptyState
          title="暂无事件关联"
          description="将两个相关事件关联起来，方便上下文检索"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加关联
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {links.map((link, idx) => (
            <Grid size={{ xs: 12, sm: 6 }} key={idx}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <LinkIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                    <Typography variant="body2" fontWeight="bold" sx={{ flex: 1 }}>
                      {link.description || "无描述"}
                    </Typography>
                    <Tooltip title="删除关联">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(link)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    A: {eventLabel(link.eventIdA)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    B: {eventLabel(link.eventIdB)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加事件关联</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="事件 A"
            value={eventIdA}
            onChange={(e) => setEventIdA(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
          >
            {(events ?? []).map((evt) => (
              <MenuItem key={evt.id} value={evt.id}>
                {eventLabel(evt.id)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="事件 B"
            value={eventIdB}
            onChange={(e) => setEventIdB(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
          >
            {(events ?? [])
              .filter((e) => e.id !== eventIdA)
              .map((evt) => (
                <MenuItem key={evt.id} value={evt.id}>
                  {eventLabel(evt.id)}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label="关联说明 (可选)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!eventIdA || !eventIdB || createLink.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除事件关联"
        message="确定要删除此事件关联吗？"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
