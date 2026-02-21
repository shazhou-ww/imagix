import type { Thing, TaxonomyNode, Event as WorldEvent } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/EventNote";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import UndoIcon from "@mui/icons-material/Undo";
import {
  Alert,
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
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useThings,
  useCreateThing,
  useUpdateThing,
  useDeleteThing,
  useEndThing,
  useUndoEndThing,
} from "@/api/hooks/useThings";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EpochTimeInput from "@/components/EpochTimeInput";
import EmptyState from "@/components/EmptyState";
import { parseEpochMs } from "@/utils/time";

function getAncestorChain(nodeId: string, nodeMap: Map<string, TaxonomyNode>): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function ThingListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { data: things, isLoading } = useThings(worldId);
  const { data: thingNodes } = useTaxonomyTree(worldId, "THING");
  const createThing = useCreateThing(worldId!);
  const updateThing = useUpdateThing(worldId!);
  const deleteThing = useDeleteThing(worldId!);
  const endThing = useEndThing(worldId!);
  const undoEndThing = useUndoEndThing(worldId!);
  const { data: events } = useEvents(worldId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThing, setEditingThing] = useState<Thing | null>(null);
  const [thingName, setThingName] = useState("");
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [creationTime, setCreationTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Thing | null>(null);
  const [endTarget, setEndTarget] = useState<Thing | null>(null);
  const [endTime, setEndTime] = useState<number>(0);
  const [endContent, setEndContent] = useState("");

  const birthEventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) {
      if (evt.system && evt.participantIds.length > 0 &&
          evt.impacts?.attributeChanges?.some((ac) => ac.attribute === "$alive" && ac.value === true)) {
        for (const pid of evt.participantIds) map.set(pid, evt);
      }
    }
    return map;
  }, [events]);

  const eventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) map.set(evt.id, evt);
    return map;
  }, [events]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of thingNodes ?? []) map.set(n.id, n);
    return map;
  }, [thingNodes]);

  const openCreate = () => {
    setEditingThing(null);
    setThingName("");
    setCategoryNodeId(thingNodes?.[0]?.id ?? "");
    setCreationTime(0);
    setDialogOpen(true);
  };

  const openEdit = (thing: Thing) => {
    setEditingThing(thing);
    setThingName(thing.name ?? "");
    setCategoryNodeId(thing.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!thingName.trim() || !categoryNodeId) return;
    if (editingThing) {
      updateThing.mutate(
        { thingId: editingThing.id, body: { name: thingName.trim(), categoryNodeId } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createThing.mutate(
        { name: thingName.trim(), categoryNodeId, creationTime },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteThing.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const openEndDialog = (thing: Thing) => {
    setEndTarget(thing);
    setEndTime(0);
    setEndContent("");
  };

  const handleEnd = () => {
    if (!endTarget) return;
    endThing.mutate(
      { thingId: endTarget.id, body: { time: endTime, content: endContent.trim() || undefined } },
      { onSuccess: () => setEndTarget(null) },
    );
  };

  // 消亡时间必须晚于创生时间
  const endTimeError = useMemo(() => {
    if (!endTarget) return "";
    const birthEvt = birthEventMap.get(endTarget.id);
    if (birthEvt && endTime <= birthEvt.time) return "消亡时间必须晚于创生时间";
    return "";
  }, [endTarget, endTime, birthEventMap]);

  const fmtTime = (ms: number) => {
    const t = parseEpochMs(ms);
    const p = ms < 0 ? "前" : "";
    return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
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
          事物
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加事物
        </Button>
      </Box>

      {!things?.length ? (
        <EmptyState
          title="暂无事物"
          description="先在分类体系中定义事物分类，然后添加事物"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加事物
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {things.map((thing) => {
            const node = nodeMap.get(thing.categoryNodeId);
            const chain = getAncestorChain(thing.categoryNodeId, nodeMap);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={thing.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {thing.name}
                      </Typography>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(thing)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(thing)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {/* Classification path */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                      {chain.length > 0 ? (
                        chain.map((n, i) => (
                          <Box key={n.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            <Chip
                              label={n.name}
                              size="small"
                              variant={i === chain.length - 1 ? "filled" : "outlined"}
                              color={i === chain.length - 1 ? "primary" : "default"}
                              sx={{ height: 22, fontSize: "0.75rem" }}
                            />
                            {i < chain.length - 1 && (
                              <Typography variant="caption" color="text.disabled">›</Typography>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Chip label={node?.name ?? "未知分类"} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.75rem" }} />
                      )}
                    </Box>
                    {/* Lifecycle events */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                      {(() => {
                        const birth = birthEventMap.get(thing.id);
                        return birth ? (
                          <Chip
                            icon={<EventIcon sx={{ fontSize: 14 }} />}
                            label={`创生 ${fmtTime(birth.time)}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem" }}
                          />
                        ) : null;
                      })()}
                      {thing.endEventId ? (
                        <>
                          <Chip
                            icon={<HighlightOffIcon sx={{ fontSize: 14 }} />}
                            label={`消亡 ${(() => { const e = eventMap.get(thing.endEventId); return e ? fmtTime(e.time) : ""; })()}`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem" }}
                          />
                          <Tooltip title="撤销消亡">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => undoEndThing.mutate(thing.id)}
                            >
                              <UndoIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Chip
                          label="标记消亡"
                          size="small"
                          variant="outlined"
                          color="default"
                          onClick={() => openEndDialog(thing)}
                          sx={{ height: 22, fontSize: "0.75rem", cursor: "pointer" }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {thing.id}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingThing ? "编辑事物" : "添加事物"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="事物名称"
            value={thingName}
            onChange={(e) => setThingName(e.target.value)}
            autoFocus
            required
          />
          {(thingNodes ?? []).length === 0 ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Typography color="text.secondary" gutterBottom>
                还没有事物分类节点
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setDialogOpen(false);
                  navigate(`/worlds/${worldId}/taxonomy/THING`);
                }}
              >
                去创建分类
              </Button>
            </Box>
          ) : (
            <TextField
              label="事物分类"
              value={categoryNodeId}
              onChange={(e) => setCategoryNodeId(e.target.value)}
              select
              slotProps={{ inputLabel: { htmlFor: undefined } }}
              required
              helperText="选择事物所属的分类节点"
            >
              {thingNodes!.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!editingThing && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>创建时间</Typography>
              <EpochTimeInput value={creationTime} onChange={setCreationTime} showPreview />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                创建后会自动生成「创建」事件。
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!thingName.trim() || !categoryNodeId || createThing.isPending || updateThing.isPending}
          >
            {editingThing ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除事物"
        message={`确定要删除「${deleteTarget?.name}」吗？相关的事件和关系不会被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* End (Destruction) Dialog */}
      <Dialog open={!!endTarget} onClose={() => setEndTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>标记消亡 — {endTarget?.name}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {endTimeError && <Alert severity="error">{endTimeError}</Alert>}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>消亡时间</Typography>
            <EpochTimeInput value={endTime} onChange={setEndTime} showPreview />
          </Box>
          <TextField
            label="消亡描述（可选）"
            value={endContent}
            onChange={(e) => setEndContent(e.target.value)}
            multiline
            rows={2}
            placeholder="如：被摧毁、遗失、耗尽"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndTarget(null)}>取消</Button>
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
