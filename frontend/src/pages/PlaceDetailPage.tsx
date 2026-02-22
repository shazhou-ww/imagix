import type { Place } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PlaceIcon from "@mui/icons-material/Place";
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
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useEvents } from "@/api/hooks/useEvents";
import {
  useDeletePlace,
  usePlace,
  usePlaces,
  useUpdatePlace,
} from "@/api/hooks/usePlaces";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";
import EntityLink from "@/components/EntityLink";
import { formatEpochMs } from "@/utils/time";

/** Build ancestor chain (bottom-up, returned top-down). */
function getAncestorChain(
  placeId: string,
  placeMap: Map<string, Place>,
): Place[] {
  const chain: Place[] = [];
  let cur = placeMap.get(placeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? placeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function PlaceDetailPage() {
  const { worldId, placeId } = useParams<{
    worldId: string;
    placeId: string;
  }>();
  const navigate = useNavigate();

  const { data: place, isLoading } = usePlace(worldId, placeId);
  const { data: places } = usePlaces(worldId);
  const { data: events } = useEvents(worldId);
  const updatePlace = useUpdatePlace(worldId ?? "");
  const deletePlace = useDeletePlace(worldId ?? "");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  const placeMap = useMemo(() => {
    const map = new Map<string, Place>();
    for (const p of places ?? []) map.set(p.id, p);
    return map;
  }, [places]);

  // Child places
  const childPlaces = useMemo(() => {
    if (!places || !placeId) return [];
    return places
      .filter((p) => p.parentId === placeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [places, placeId]);

  // Events at this place
  const placeEvents = useMemo(() => {
    if (!events || !placeId) return [];
    return events
      .filter((e) => e.placeId === placeId)
      .sort((a, b) => a.time - b.time);
  }, [events, placeId]);

  if (!worldId || !placeId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!place) {
    return <Navigate to={`/worlds/${worldId}/places`} replace />;
  }

  const ancestors = getAncestorChain(place.id, placeMap);
  // Only available parents: all places except this one and its descendants
  const getDescendantIds = (pid: string): Set<string> => {
    const ids = new Set<string>();
    ids.add(pid);
    for (const p of places ?? []) {
      if (p.parentId && ids.has(p.parentId)) ids.add(p.id);
    }
    return ids;
  };
  const descendantIds = getDescendantIds(place.id);
  const parentOptions = (places ?? []).filter((p) => !descendantIds.has(p.id));

  const openEdit = () => {
    setEditName(place.name);
    setEditParentId(place.parentId);
    setEditDesc(place.description ?? "");
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updatePlace.mutate(
      {
        placeId: place.id,
        body: {
          name: editName.trim(),
          parentId: editParentId,
          description: editDesc.trim() || undefined,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    deletePlace.mutate(place.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/places`),
    });
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "地点", to: `/worlds/${worldId}/places` },
          ...ancestors.slice(0, -1).map((a) => ({
            label: a.name,
            to: `/worlds/${worldId}/places/${a.id}`,
          })),
          { label: place.name },
        ]}
        title={place.name}
        subtitle={
          ancestors.length > 1
            ? ancestors.map((a) => a.name).join(" › ")
            : undefined
        }
        actions={
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
        }
      />

      {/* Basic Info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          基本信息
        </Typography>
        <EditableField
          label="名称"
          value={place.name}
          onSave={(v) =>
            updatePlace.mutate({ placeId: place.id, body: { name: v } })
          }
          required
          saving={updatePlace.isPending}
        />
        <EditableField
          label="描述"
          value={place.description ?? ""}
          onSave={(v) =>
            updatePlace.mutate({
              placeId: place.id,
              body: { description: v || undefined },
            })
          }
          multiline
          rows={3}
          placeholder="暂无描述"
          saving={updatePlace.isPending}
        />
        {place.parentId && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              上级地点
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <EntityLink
                entityId={place.parentId}
                worldId={worldId}
                label={placeMap.get(place.parentId)?.name}
              />
            </Box>
          </Box>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          ID: {place.id}
        </Typography>
      </Paper>

      {/* Child Places */}
      {childPlaces.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            子地点（{childPlaces.length}）
          </Typography>
          <List dense disablePadding>
            {childPlaces.map((child) => (
              <ListItemButton
                key={child.id}
                onClick={() =>
                  navigate(`/worlds/${worldId}/places/${child.id}`)
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <PlaceIcon fontSize="small" color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={child.name}
                  secondary={child.description || undefined}
                  secondaryTypographyProps={{
                    noWrap: true,
                    sx: { maxWidth: 400 },
                  }}
                />
                {(places ?? []).some((p) => p.parentId === child.id) && (
                  <Chip
                    label="有子地点"
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, height: 20, fontSize: "0.7rem" }}
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      {/* Events at this Place */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          此地点的事件（{placeEvents.length}）
        </Typography>
        {placeEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            暂无在此地点发生的事件
          </Typography>
        ) : (
          <List dense disablePadding>
            {placeEvents.map((evt) => (
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
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑地点</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="地点名称"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="上级地点（可选）"
            value={editParentId ?? ""}
            onChange={(e) => setEditParentId(e.target.value || null)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            <MenuItem value="">（顶层地点）</MenuItem>
            {parentOptions.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="地点描述（可选）"
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
            disabled={!editName.trim() || updatePlace.isPending}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除地点"
        message={`确定要删除「${place.name}」吗？${
          childPlaces.length > 0
            ? `该地点下有 ${childPlaces.length} 个子地点，需要先移走或删除子地点。`
            : ""
        }`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deletePlace.isPending}
      />
    </Box>
  );
}
