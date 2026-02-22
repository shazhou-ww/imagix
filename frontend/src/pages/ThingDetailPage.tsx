import type { TaxonomyNode } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import UndoIcon from "@mui/icons-material/Undo";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import {
  useDeleteThing,
  useEndThing,
  useThing,
  useUndoEndThing,
  useUpdateThing,
} from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EditableField from "@/components/EditableField";
import EntityStatePanel from "@/components/EntityStatePanel";
import EpochTimeInput from "@/components/EpochTimeInput";
import RelatedEventList from "@/components/RelatedEventList";
import RelatedRelationshipList from "@/components/RelatedRelationshipList";
import { parseEpochMs } from "@/utils/time";

function getAncestorChain(
  nodeId: string,
  nodeMap: Map<string, TaxonomyNode>,
): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function ThingDetailPage() {
  const { worldId, thingId } = useParams<{
    worldId: string;
    thingId: string;
  }>();
  const navigate = useNavigate();

  const { data: thing, isLoading } = useThing(worldId, thingId);
  const { data: thingNodes } = useTaxonomyTree(worldId, "THING");
  const { data: events } = useEvents(worldId);
  const updateThing = useUpdateThing(worldId ?? "");
  const deleteThing = useDeleteThing(worldId ?? "");
  const endThing = useEndThing(worldId ?? "");
  const undoEndThing = useUndoEndThing(worldId ?? "");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [endOpen, setEndOpen] = useState(false);
  const [endTime, setEndTime] = useState(0);
  const [endContent, setEndContent] = useState("");

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of thingNodes ?? []) map.set(n.id, n);
    return map;
  }, [thingNodes]);

  const birthEvent = useMemo(() => {
    if (!thing || !events) return undefined;
    return events.find(
      (evt) =>
        evt.system &&
        evt.impacts?.attributeChanges?.some(
          (ac) =>
            ac.entityId === thing.id &&
            ac.attribute === "$alive" &&
            ac.value === true,
        ),
    );
  }, [thing, events]);

  const endEvent = useMemo(() => {
    if (!thing?.endEventId || !events) return undefined;
    return events.find((e) => e.id === thing.endEventId);
  }, [thing, events]);

  const endTimeError = useMemo(() => {
    if (!birthEvent) return "";
    if (endTime <= birthEvent.time) return "消亡时间必须晚于创建时间";
    return "";
  }, [endTime, birthEvent]);

  const fmtTime = (ms: number) => {
    const t = parseEpochMs(ms);
    const p = ms < 0 ? "前" : "";
    return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
  };

  if (!worldId || !thingId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!thing) {
    return <Navigate to={`/worlds/${worldId}/things`} replace />;
  }

  const chain = getAncestorChain(thing.categoryNodeId, nodeMap);
  const isAlive = !thing.endEventId;

  const openEdit = () => {
    setEditName(thing.name);
    setEditDesc(thing.description ?? "");
    setEditCategory(thing.categoryNodeId);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editCategory) return;
    updateThing.mutate(
      {
        thingId: thing.id,
        body: {
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          categoryNodeId: editCategory,
        },
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    deleteThing.mutate(thing.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/things`),
    });
  };

  const handleEnd = () => {
    endThing.mutate(
      {
        thingId: thing.id,
        body: { time: endTime, content: endContent.trim() || undefined },
      },
      { onSuccess: () => setEndOpen(false) },
    );
  };

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "事物", to: `/worlds/${worldId}/things` },
          { label: thing.name },
        ]}
        title={thing.name}
        subtitle={chain.map((n) => n.name).join(" › ")}
        status={
          isAlive
            ? { label: "存续中", color: "success" }
            : { label: "已消亡", color: "error" }
        }
        actions={
          <>
            <Button size="small" startIcon={<EditIcon />} onClick={openEdit}>
              编辑
            </Button>
            {isAlive ? (
              <Button
                size="small"
                color="error"
                startIcon={<HighlightOffIcon />}
                onClick={() => {
                  setEndTime(0);
                  setEndContent("");
                  setEndOpen(true);
                }}
              >
                标记消亡
              </Button>
            ) : (
              <Button
                size="small"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => undoEndThing.mutate(thing.id)}
              >
                撤销消亡
              </Button>
            )}
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
          value={thing.name}
          onSave={(v) =>
            updateThing.mutate({ thingId: thing.id, body: { name: v } })
          }
          required
          saving={updateThing.isPending}
        />
        <EditableField
          label="描述"
          value={thing.description ?? ""}
          onSave={(v) =>
            updateThing.mutate({
              thingId: thing.id,
              body: { description: v || undefined },
            })
          }
          multiline
          rows={3}
          placeholder="暂无描述"
          saving={updateThing.isPending}
        />
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            分类
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexWrap: "wrap",
              mt: 0.5,
            }}
          >
            {chain.map((n, i) => (
              <Box
                key={n.id}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Chip
                  label={n.name}
                  size="small"
                  variant={i === chain.length - 1 ? "filled" : "outlined"}
                  color={i === chain.length - 1 ? "primary" : "default"}
                  sx={{ height: 22, fontSize: "0.75rem" }}
                />
                {i < chain.length - 1 && (
                  <Typography variant="caption" color="text.disabled">
                    ›
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mt: 1,
          }}
        >
          {birthEvent && (
            <Chip
              label={`创建 ${fmtTime(birthEvent.time)}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
          {endEvent && (
            <Chip
              label={`消亡 ${fmtTime(endEvent.time)}`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          ID: {thing.id}
        </Typography>
      </Paper>

      {/* State Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          当前状态（属性快照）
        </Typography>
        <EntityStatePanel worldId={worldId} entityId={thing.id} />
      </Paper>

      {/* Relationships */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          关系
        </Typography>
        <RelatedRelationshipList worldId={worldId} entityId={thing.id} />
      </Paper>

      {/* Events Timeline */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          事件时间线
        </Typography>
        <RelatedEventList worldId={worldId} entityId={thing.id} />
      </Paper>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>编辑事物</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          <TextField
            label="事物名称"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="事物描述（可选）"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            multiline
            rows={2}
          />
          <TextField
            label="事物分类"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            select
            required
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            {thingNodes?.map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={
              !editName.trim() || !editCategory || updateThing.isPending
            }
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除事物"
        message={`确定要删除「${thing.name}」吗？相关的事件和关系不会被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteThing.isPending}
      />

      {/* End Dialog */}
      <Dialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>标记消亡 — {thing.name}</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "8px !important",
          }}
        >
          {endTimeError && <Alert severity="error">{endTimeError}</Alert>}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              消亡时间
            </Typography>
            <EpochTimeInput value={endTime} onChange={setEndTime} showPreview />
          </Box>
          <TextField
            label="消亡描述（可选）"
            value={endContent}
            onChange={(e) => setEndContent(e.target.value)}
            multiline
            rows={2}
            placeholder="如：毁坏、消失"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndOpen(false)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEnd}
            disabled={endThing.isPending || !!endTimeError}
          >
            确认消亡
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
