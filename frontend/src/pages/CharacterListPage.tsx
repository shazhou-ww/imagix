import type { Character, TaxonomyNode, Event as WorldEvent } from "@imagix/shared";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useCharacters,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
  useEndCharacter,
  useUndoEndCharacter,
} from "@/api/hooks/useCharacters";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import ConfirmDialog from "@/components/ConfirmDialog";
import EpochTimeInput from "@/components/EpochTimeInput";
import EmptyState from "@/components/EmptyState";
import { parseEpochMs } from "@/utils/time";

/** Build ancestor chain for a node (bottom-up, returned top-down). */
function getAncestorChain(nodeId: string, nodeMap: Map<string, TaxonomyNode>): TaxonomyNode[] {
  const chain: TaxonomyNode[] = [];
  let cur = nodeMap.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
  }
  return chain;
}

export default function CharacterListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: characters, isLoading } = useCharacters(worldId);
  const { data: charNodes } = useTaxonomyTree(worldId, "CHAR");
  const createChar = useCreateCharacter(worldId!);
  const updateChar = useUpdateCharacter(worldId!);
  const deleteChar = useDeleteCharacter(worldId!);
  const endChar = useEndCharacter(worldId!);
  const undoEndChar = useUndoEndCharacter(worldId!);
  const { data: events } = useEvents(worldId);

  const scrolledRef = useRef(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [charName, setCharName] = useState("");
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [birthTime, setBirthTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [endTarget, setEndTarget] = useState<Character | null>(null);
  const [endTime, setEndTime] = useState<number>(0);
  const [endContent, setEndContent] = useState("");

  // Build a map: entityId → birth event
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

  // Build a map: eventId → event for looking up end events
  const eventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) map.set(evt.id, evt);
    return map;
  }, [events]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of charNodes ?? []) map.set(n.id, n);
    return map;
  }, [charNodes]);

  // Scroll to entity by hash
  useEffect(() => {
    if (scrolledRef.current || !characters?.length) return;
    const hash = location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      scrolledRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid";
      el.style.outlineColor = "var(--mui-palette-primary-main, #1976d2)";
      el.style.borderRadius = "8px";
      setTimeout(() => { el.style.outline = "none"; }, 2000);
    }
  }, [location.hash, characters]);

  const openCreate = () => {
    setEditingChar(null);
    setCharName("");
    setCategoryNodeId(charNodes?.[0]?.id ?? "");
    setBirthTime(0);
    setDialogOpen(true);
  };

  const openEdit = (char: Character) => {
    setEditingChar(char);
    setCharName(char.name ?? "");
    setCategoryNodeId(char.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!charName.trim() || !categoryNodeId) return;
    if (editingChar) {
      updateChar.mutate(
        { charId: editingChar.id, body: { name: charName.trim(), categoryNodeId } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createChar.mutate(
        { name: charName.trim(), categoryNodeId, birthTime },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteChar.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const openEndDialog = (char: Character) => {
    setEndTarget(char);
    setEndTime(0);
    setEndContent("");
  };

  const handleEnd = () => {
    if (!endTarget) return;
    endChar.mutate(
      { charId: endTarget.id, body: { time: endTime, content: endContent.trim() || undefined } },
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
          角色
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          添加角色
        </Button>
      </Box>

      {!characters?.length ? (
        <EmptyState
          title="暂无角色"
          description="先在分类体系中定义角色分类，然后添加角色"
          action={
            <Button variant="outlined" onClick={openCreate}>
              添加角色
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2}>
          {characters.map((char) => {
            const node = nodeMap.get(char.categoryNodeId);
            const chain = getAncestorChain(char.categoryNodeId, nodeMap);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={char.id}>
                <Card id={char.id}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>
                        {char.name}
                      </Typography>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => openEdit(char)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(char)}>
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
                        const birth = birthEventMap.get(char.id);
                        return birth ? (
                          <Chip
                            icon={<EventIcon sx={{ fontSize: 14 }} />}
                            label={`创生 ${fmtTime(birth.time)}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem", cursor: "pointer" }}
                            onClick={() => navigate(`/worlds/${worldId}/events#${birth.id}`)}
                          />
                        ) : null;
                      })()}
                      {char.endEventId ? (
                        <>
                          <Chip
                            icon={<HighlightOffIcon sx={{ fontSize: 14 }} />}
                            label={`消亡 ${(() => { const e = eventMap.get(char.endEventId); return e ? fmtTime(e.time) : ""; })()}`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.75rem", cursor: "pointer" }}
                            onClick={() => navigate(`/worlds/${worldId}/events#${char.endEventId}`)}
                          />
                          <Tooltip title="撤销消亡">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => undoEndChar.mutate(char.id)}
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
                          onClick={() => openEndDialog(char)}
                          sx={{ height: 22, fontSize: "0.75rem", cursor: "pointer" }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      {char.id}
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
        <DialogTitle>{editingChar ? "编辑角色" : "添加角色"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField
            label="角色名称"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            autoFocus
            required
          />
          {(charNodes ?? []).length === 0 ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Typography color="text.secondary" gutterBottom>
                还没有角色分类节点
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setDialogOpen(false);
                  navigate(`/worlds/${worldId}/taxonomy/CHAR`);
                }}
              >
                去创建分类
              </Button>
            </Box>
          ) : (
            <TextField
              label="角色分类"
              value={categoryNodeId}
              onChange={(e) => setCategoryNodeId(e.target.value)}
              select
              slotProps={{ inputLabel: { htmlFor: undefined } }}
              required
              helperText="选择角色所属的分类节点"
            >
              {charNodes!.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!editingChar && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>诞生时间</Typography>
              <EpochTimeInput value={birthTime} onChange={setBirthTime} showPreview />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                创建后会自动生成「诞生」事件。
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!charName.trim() || !categoryNodeId || createChar.isPending || updateChar.isPending}
          >
            {editingChar ? "保存" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除角色"
        message={`确定要删除「${deleteTarget?.name}」吗？相关的事件和关系不会被删除。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* End (Death) Dialog */}
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
            placeholder="如：战死沙场、寿终正寝"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndTarget(null)}>取消</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleEnd}
            disabled={endChar.isPending || !!endTimeError}
          >
            确认消亡
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
