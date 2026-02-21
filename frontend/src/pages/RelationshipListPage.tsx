import type { Relationship, TaxonomyNode, Event as WorldEvent } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useRelationships,
  useCreateRelationship,
  useDeleteRelationship,
  useEndRelationship,
  useUndoEndRelationship,
} from "@/api/hooks/useRelationships";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useThings } from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import EpochTimeInput from "@/components/EpochTimeInput";
import EmptyState from "@/components/EmptyState";
import { parseEpochMs } from "@/utils/time";

export default function RelationshipListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: relationships, isLoading } = useRelationships(worldId);
  const { data: relNodes } = useTaxonomyTree(worldId, "REL");
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const createRel = useCreateRelationship(worldId!);
  const deleteRel = useDeleteRelationship(worldId!);
  const endRel = useEndRelationship(worldId!);
  const undoEndRel = useUndoEndRelationship(worldId!);
  const { data: events } = useEvents(worldId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeNodeId, setTypeNodeId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [establishTime, setEstablishTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Relationship | null>(null);
  const [endTarget, setEndTarget] = useState<Relationship | null>(null);
  const [endTime, setEndTime] = useState<number>(0);
  const [endContent, setEndContent] = useState("");

  const birthEventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) {
      const birthAc = evt.system && evt.impacts?.attributeChanges?.find(
        (ac) => ac.attribute === "$alive" && ac.value === true,
      );
      if (birthAc) map.set(birthAc.entityId, evt);
    }
    return map;
  }, [events]);

  const eventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) map.set(evt.id, evt);
    return map;
  }, [events]);

  const relNodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of relNodes ?? []) map.set(n.id, n);
    return map;
  }, [relNodes]);

  // Direction sub-nodes: the 3 system children of the REL root ("角色→角色", "角色→事物", "事物→事物")
  const directionNodes = useMemo(
    () => (relNodes ?? []).filter((n) => n.parentId !== null && relNodeMap.get(n.parentId!)?.parentId === null),
    [relNodes, relNodeMap],
  );

  // Leaf type nodes: nodes whose parent is one of the direction nodes (user-created relationship types)
  const typeNodes = useMemo(
    () => {
      const dirIds = new Set(directionNodes.map((n) => n.id));
      return (relNodes ?? []).filter((n) => n.parentId && dirIds.has(n.parentId));
    },
    [relNodes, directionNodes],
  );

  /** Given a type node id, find its direction ancestor name to determine from/to entity types */
  const getDirection = useCallback(
    (nodeId: string): "char-char" | "char-thing" | "thing-thing" | null => {
      const dirIds = new Set(directionNodes.map((n) => n.id));
      let current = nodeId;
      // Walk up until we find a direction node
      while (current) {
        if (dirIds.has(current)) {
          const name = relNodeMap.get(current)?.name ?? "";
          if (name.includes("角色") && name.includes("事物")) return "char-thing";
          if (name.includes("事物")) return "thing-thing";
          return "char-char";
        }
        const parent = relNodeMap.get(current)?.parentId;
        if (!parent) break;
        current = parent;
      }
      return null;
    },
    [directionNodes, relNodeMap],
  );

  const direction = getDirection(typeNodeId);

  // Build entity options based on direction type
  const charOptions = useMemo(
    () => (characters ?? []).map((c) => ({ id: c.id, label: c.name })),
    [characters],
  );
  const thingOptions = useMemo(
    () => (things ?? []).map((t) => ({ id: t.id, label: t.name })),
    [things],
  );

  const fromOptions = direction === "thing-thing" ? thingOptions : charOptions;
  const toOptions = direction === "char-char" ? charOptions : thingOptions;

  // Label map for displaying entity names on cards
  const entityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) map.set(c.id, c.name);
    for (const t of things ?? []) map.set(t.id, t.name);
    return map;
  }, [characters, things]);

  const openCreate = () => {
    setTypeNodeId("");
    setFromId("");
    setToId("");
    setEstablishTime(0);
    setDialogOpen(true);
  };

  const handleTypeChange = (nodeId: string) => {
    setTypeNodeId(nodeId);
    setFromId("");
    setToId("");
  };

  const handleCreate = () => {
    if (!typeNodeId || !fromId || !toId) return;
    createRel.mutate(
      { typeNodeId, fromId, toId, establishTime },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRel.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const openEndDialog = (rel: Relationship) => {
    setEndTarget(rel);
    setEndTime(0);
    setEndContent("");
  };

  const handleEnd = () => {
    if (!endTarget) return;
    endRel.mutate(
      { relId: endTarget.id, body: { time: endTime, content: endContent.trim() || undefined } },
      { onSuccess: () => setEndTarget(null) },
    );
  };

  // 解除时间必须晚于建立时间
  const endTimeError = useMemo(() => {
    if (!endTarget) return "";
    const birthEvt = birthEventMap.get(endTarget.id);
    if (birthEvt && endTime <= birthEvt.time) return "解除时间必须晚于建立时间";
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
          关系
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加关系
        </Button>
      </Box>

      {!relationships?.length ? (
        <EmptyState
          title="暂无关系"
          description="在分类体系中定义关系类型，然后建立实体间的关系"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加关系
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {relationships.map((rel) => {
            const typeNode = relNodeMap.get(rel.typeNodeId);
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={rel.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Chip label={typeNode?.name ?? "未知类型"} size="small" color="primary" />
                      <Box sx={{ flex: 1 }} />
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(rel)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {entityLabelMap.get(rel.fromId) ?? rel.fromId}
                      </Typography>
                      <ArrowForwardIcon fontSize="small" color="action" />
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {entityLabelMap.get(rel.toId) ?? rel.toId}
                      </Typography>
                    </Box>
                    {/* Lifecycle events */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                      {(() => {
                        const birth = birthEventMap.get(rel.id);
                        return birth ? (
                          <Chip
                            icon={<EventIcon sx={{ fontSize: 14 }} />}
                            label={`建立 ${fmtTime(birth.time)}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem" }}
                          />
                        ) : null;
                      })()}
                      {rel.endEventId ? (
                        <>
                          <Chip
                            icon={<HighlightOffIcon sx={{ fontSize: 14 }} />}
                            label={`解除 ${(() => { const e = eventMap.get(rel.endEventId); return e ? fmtTime(e.time) : ""; })()}`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem" }}
                          />
                          <Tooltip title="撤销解除">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => undoEndRel.mutate(rel.id)}
                            >
                              <UndoIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Chip
                          label="标记解除"
                          size="small"
                          variant="outlined"
                          color="default"
                          onClick={() => openEndDialog(rel)}
                          sx={{ height: 22, fontSize: "0.75rem", cursor: "pointer" }}
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加关系</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="关系类型"
            value={typeNodeId}
            onChange={(e) => handleTypeChange(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            helperText="在分类体系的关系类型树中，于对应方向分类下定义具体关系类型"
          >
            {directionNodes.map((dirNode) => {
              const children = typeNodes.filter((n) => n.parentId === dirNode.id);
              return [
                <MenuItem key={`header-${dirNode.id}`} disabled sx={{ opacity: 0.7, fontWeight: "bold", fontSize: "0.85rem" }}>
                  {dirNode.name}
                </MenuItem>,
                ...children.map((n) => (
                  <MenuItem key={n.id} value={n.id} sx={{ pl: 4 }}>
                    {n.name}
                  </MenuItem>
                )),
              ];
            })}
          </TextField>
          <TextField
            label={direction === "thing-thing" ? "源事物" : "源角色"}
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            disabled={!direction}
          >
            {fromOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={direction === "char-char" ? "目标角色" : "目标事物"}
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            select
            slotProps={{ inputLabel: { htmlFor: undefined } }}
            required
            disabled={!direction}
          >
            {toOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>建立时间</Typography>
            <EpochTimeInput value={establishTime} onChange={setEstablishTime} showPreview />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              创建后会自动生成「建立」事件。
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!typeNodeId || !fromId || !toId || fromId === toId || createRel.isPending}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除关系"
        message="确定要删除此关系吗？"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* End (Dissolve) Dialog */}
      <Dialog open={!!endTarget} onClose={() => setEndTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>标记解除</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {endTimeError && <Alert severity="error">{endTimeError}</Alert>}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>解除时间</Typography>
            <EpochTimeInput value={endTime} onChange={setEndTime} showPreview />
          </Box>
          <TextField
            label="解除描述（可选）"
            value={endContent}
            onChange={(e) => setEndContent(e.target.value)}
            multiline
            rows={2}
            placeholder="如：反目成仇、合约到期"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndTarget(null)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEnd}
            disabled={endRel.isPending || !!endTimeError}
          >
            确认解除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
