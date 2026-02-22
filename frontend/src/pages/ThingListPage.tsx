import type { TaxonomyNode, Thing, Event as WorldEvent } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/EventNote";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import SearchIcon from "@mui/icons-material/Search";
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
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEvents } from "@/api/hooks/useEvents";
import { useTaxonomyTree } from "@/api/hooks/useTaxonomy";
import {
  useCreateThing,
  useDeleteThing,
  useEndThing,
  useThings,
  useUndoEndThing,
  useUpdateThing,
} from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import EpochTimeInput from "@/components/EpochTimeInput";
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

export default function ThingListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const scrolledRef = useRef(false);
  const { data: things, isLoading } = useThings(worldId);
  const { data: thingNodes } = useTaxonomyTree(worldId, "THING");
  const createThing = useCreateThing(worldId ?? "");
  const updateThing = useUpdateThing(worldId ?? "");
  const deleteThing = useDeleteThing(worldId ?? "");
  const endThing = useEndThing(worldId ?? "");
  const undoEndThing = useUndoEndThing(worldId ?? "");
  const { data: events } = useEvents(worldId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingThing, setEditingThing] = useState<Thing | null>(null);
  const [thingName, setThingName] = useState("");
  const [thingDescription, setThingDescription] = useState("");
  const [categoryNodeId, setCategoryNodeId] = useState("");
  const [creationTime, setCreationTime] = useState<number>(0);
  const [deleteTarget, setDeleteTarget] = useState<Thing | null>(null);
  const [endTarget, setEndTarget] = useState<Thing | null>(null);
  const [endTime, setEndTime] = useState<number>(0);
  const [endContent, setEndContent] = useState("");

  // Filter state
  const [filterName, setFilterName] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "alive" | "ended">(
    "all",
  );

  const birthEventMap = useMemo(() => {
    const map = new Map<string, WorldEvent>();
    for (const evt of events ?? []) {
      const birthAc =
        evt.system &&
        evt.impacts?.attributeChanges?.find(
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

  const nodeMap = useMemo(() => {
    const map = new Map<string, TaxonomyNode>();
    for (const n of thingNodes ?? []) map.set(n.id, n);
    return map;
  }, [thingNodes]);

  // Filtered list
  const filteredThings = useMemo(() => {
    let result = things ?? [];
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (filterCategoryId) {
      const ids = new Set<string>();
      const collect = (nid: string) => {
        ids.add(nid);
        for (const n of thingNodes ?? []) {
          if (n.parentId === nid) collect(n.id);
        }
      };
      collect(filterCategoryId);
      result = result.filter((t) => ids.has(t.categoryNodeId));
    }
    if (filterStatus === "alive") result = result.filter((t) => !t.endEventId);
    else if (filterStatus === "ended")
      result = result.filter((t) => !!t.endEventId);
    return result;
  }, [things, filterName, filterCategoryId, filterStatus, thingNodes]);

  // Scroll to entity by hash
  useEffect(() => {
    if (scrolledRef.current || !things?.length) return;
    const hash = location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      scrolledRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid";
      el.style.outlineColor = "var(--mui-palette-primary-main, #1976d2)";
      el.style.borderRadius = "8px";
      setTimeout(() => {
        el.style.outline = "none";
      }, 2000);
    }
  }, [location.hash, things]);

  const openCreate = () => {
    setEditingThing(null);
    setThingName("");
    setThingDescription("");
    setCategoryNodeId(thingNodes?.[0]?.id ?? "");
    setCreationTime(0);
    setDialogOpen(true);
  };

  const openEdit = (thing: Thing) => {
    setEditingThing(thing);
    setThingName(thing.name ?? "");
    setThingDescription(thing.description ?? "");
    setCategoryNodeId(thing.categoryNodeId);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!thingName.trim() || !categoryNodeId) return;
    if (editingThing) {
      updateThing.mutate(
        {
          thingId: editingThing.id,
          body: {
            name: thingName.trim(),
            description: thingDescription.trim() || undefined,
            categoryNodeId,
          },
        },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createThing.mutate(
        {
          name: thingName.trim(),
          description: thingDescription.trim() || undefined,
          categoryNodeId,
          creationTime,
        },
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
      {
        thingId: endTarget.id,
        body: { time: endTime, content: endContent.trim() || undefined },
      },
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h4" fontWeight="bold">
          事物
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          添加事物
        </Button>
      </Box>

      {(things?.length ?? 0) > 0 && (
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="搜索事物"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            size="small"
            select
            label="分类"
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            sx={{ minWidth: 150 }}
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            <MenuItem value="">全部</MenuItem>
            {(thingNodes ?? []).map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            select
            label="状态"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "alive" | "ended")
            }
            sx={{ minWidth: 120 }}
            slotProps={{ inputLabel: { htmlFor: undefined } }}
          >
            <MenuItem value="all">全部</MenuItem>
            <MenuItem value="alive">存续中</MenuItem>
            <MenuItem value="ended">已消亡</MenuItem>
          </TextField>
        </Box>
      )}

      {!filteredThings.length ? (
        <EmptyState
          title={things?.length ? "无匹配事物" : "暂无事物"}
          description={
            things?.length
              ? "尝试调整筛选条件"
              : "先在分类体系中定义事物分类，然后添加事物"
          }
          action={
            things?.length ? (
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterName("");
                  setFilterCategoryId("");
                  setFilterStatus("all");
                }}
              >
                清除筛选
              </Button>
            ) : (
              <Button variant="outlined" onClick={openCreate}>
                添加事物
              </Button>
            )
          }
        />
      ) : (
        <Grid container spacing={2}>
          {filteredThings.map((thing) => {
            const node = nodeMap.get(thing.categoryNodeId);
            const chain = getAncestorChain(thing.categoryNodeId, nodeMap);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={thing.id}>
                <Card id={thing.id}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        sx={{
                          flex: 1,
                          cursor: "pointer",
                          "&:hover": { color: "primary.main" },
                        }}
                        onClick={() =>
                          navigate(`/worlds/${worldId}/things/${thing.id}`)
                        }
                      >
                        {thing.name}
                      </Typography>
                      <Tooltip title="编辑">
                        <IconButton
                          size="small"
                          onClick={() => openEdit(thing)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(thing)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {/* Description */}
                    {thing.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        {thing.description}
                      </Typography>
                    )}
                    {/* Classification path */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      {chain.length > 0 ? (
                        chain.map((n, i) => (
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
                              variant={
                                i === chain.length - 1 ? "filled" : "outlined"
                              }
                              color={
                                i === chain.length - 1 ? "primary" : "default"
                              }
                              sx={{ height: 22, fontSize: "0.75rem" }}
                            />
                            {i < chain.length - 1 && (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                ›
                              </Typography>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Chip
                          label={node?.name ?? "未知分类"}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22, fontSize: "0.75rem" }}
                        />
                      )}
                    </Box>
                    {/* Lifecycle events */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        flexWrap: "wrap",
                        mt: 1,
                      }}
                    >
                      {(() => {
                        const birth = birthEventMap.get(thing.id);
                        return birth ? (
                          <Chip
                            icon={<EventIcon sx={{ fontSize: 14 }} />}
                            label={`创生 ${fmtTime(birth.time)}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{
                              height: 22,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              navigate(`/worlds/${worldId}/events#${birth.id}`)
                            }
                          />
                        ) : null;
                      })()}
                      {thing.endEventId ? (
                        <>
                          <Chip
                            icon={<HighlightOffIcon sx={{ fontSize: 14 }} />}
                            label={`消亡 ${(() => {
                              const e = eventMap.get(thing.endEventId);
                              return e ? fmtTime(e.time) : "";
                            })()}`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{
                              height: 22,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                            onClick={() =>
                              navigate(
                                `/worlds/${worldId}/events#${thing.endEventId}`,
                              )
                            }
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
                          sx={{
                            height: 22,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        />
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: "block" }}
                    >
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
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingThing ? "编辑事物" : "添加事物"}</DialogTitle>
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
            value={thingName}
            onChange={(e) => setThingName(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="事物描述（可选）"
            value={thingDescription}
            onChange={(e) => setThingDescription(e.target.value)}
            multiline
            rows={2}
            placeholder="简要描述事物的来历、特性等"
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
              {thingNodes?.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!editingThing && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                创建时间
              </Typography>
              <EpochTimeInput
                value={creationTime}
                onChange={setCreationTime}
                showPreview
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: "block" }}
              >
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
            disabled={
              !thingName.trim() ||
              !categoryNodeId ||
              createThing.isPending ||
              updateThing.isPending
            }
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
      <Dialog
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>标记消亡 — {endTarget?.name}</DialogTitle>
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
