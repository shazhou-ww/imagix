import type { Event as WorldEvent, AttributeChange } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
  Autocomplete,
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
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/api/hooks/useEvents";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useThings } from "@/api/hooks/useThings";
import { useAttributeDefinitions } from "@/api/hooks/useAttributeDefinitions";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { formatEpochMs } from "@/utils/time";

// Group flat AttributeChange[] by entityId for grouped UI rendering
interface AttrChangeGroup {
  entityId: string;
  entityType: "character" | "thing";
  changes: { attribute: string; value: string | number | boolean; flatIdx: number }[];
}

function groupByEntity(changes: AttributeChange[]): AttrChangeGroup[] {
  const groups: AttrChangeGroup[] = [];
  const map = new Map<string, AttrChangeGroup>();
  changes.forEach((ac, idx) => {
    let group = map.get(ac.entityId);
    if (!group) {
      group = { entityId: ac.entityId, entityType: ac.entityType, changes: [] };
      map.set(ac.entityId, group);
      groups.push(group);
    }
    group.changes.push({ attribute: ac.attribute, value: ac.value, flatIdx: idx });
  });
  return groups;
}

export default function EventListPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { data: events, isLoading } = useEvents(worldId);
  const createEvent = useCreateEvent(worldId!);
  const updateEvent = useUpdateEvent(worldId!);
  const deleteEvent = useDeleteEvent(worldId!);
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const { data: attrDefs } = useAttributeDefinitions(worldId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WorldEvent | null>(null);
  const [time, setTime] = useState<number>(0);
  const [content, setContent] = useState("");
  const [attrChanges, setAttrChanges] = useState<AttributeChange[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<WorldEvent | null>(null);

  // Build entity options for autocomplete
  const entityOptions = useMemo(() => {
    const opts: { id: string; name: string; type: "character" | "thing" }[] = [];
    for (const c of characters ?? []) opts.push({ id: c.id, name: c.name, type: "character" });
    for (const t of things ?? []) opts.push({ id: t.id, name: t.name, type: "thing" });
    return opts;
  }, [characters, things]);

  // Grouped view of attribute changes
  const groupedAttrChanges = useMemo(() => groupByEntity(attrChanges), [attrChanges]);

  // Add a new entity group (with one empty attribute row)
  const addEntityGroup = useCallback(
    (entity: { id: string; type: "character" | "thing" }) => {
      setAttrChanges((prev) => [
        ...prev,
        { entityType: entity.type, entityId: entity.id, attribute: "", value: "" },
      ]);
    },
    [],
  );

  // Add a new attribute row to an existing entity group
  const addAttrToGroup = useCallback(
    (entityId: string, entityType: "character" | "thing") => {
      setAttrChanges((prev) => [
        ...prev,
        { entityType, entityId, attribute: "", value: "" },
      ]);
    },
    [],
  );

  // Remove an entire entity group
  const removeEntityGroup = useCallback(
    (entityId: string) => {
      setAttrChanges((prev) => prev.filter((ac) => ac.entityId !== entityId));
    },
    [],
  );

  // Remove a single attribute row by flat index
  const removeAttrRow = useCallback(
    (flatIdx: number) => {
      setAttrChanges((prev) => prev.filter((_, i) => i !== flatIdx));
    },
    [],
  );

  // Update a single attribute row by flat index
  const updateAttrRow = useCallback(
    (flatIdx: number, patch: Partial<AttributeChange>) => {
      setAttrChanges((prev) => prev.map((ac, i) => (i === flatIdx ? { ...ac, ...patch } : ac)));
    },
    [],
  );

  const sortedEvents = useMemo(
    () => [...(events ?? [])].sort((a, b) => a.time - b.time),
    [events],
  );

  const openCreate = () => {
    setEditingEvent(null);
    setTime(0);
    setContent("");
    setAttrChanges([]);
    setDialogOpen(true);
  };

  const openEdit = (evt: WorldEvent) => {
    setEditingEvent(evt);
    setTime(evt.time);
    setContent(evt.content);
    setAttrChanges(evt.impacts?.attributeChanges ?? []);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const impacts = {
      attributeChanges: attrChanges,
      relationshipChanges: editingEvent?.impacts?.relationshipChanges ?? [],
      relationshipAttributeChanges: editingEvent?.impacts?.relationshipAttributeChanges ?? [],
    };
    if (editingEvent) {
      updateEvent.mutate(
        { eventId: editingEvent.id, body: { time, content: content.trim(), impacts } },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createEvent.mutate(
        { time, content: content.trim(), impacts },
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
                  {evt.impacts?.attributeChanges?.length > 0 && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                      {evt.impacts.attributeChanges.map((ac, i) => {
                        const entity = entityOptions.find((e) => e.id === ac.entityId);
                        return (
                          <Chip
                            key={`${ac.entityId}-${ac.attribute}-${i}`}
                            label={`${entity?.name ?? ac.entityId.slice(0, 8)}·${ac.attribute}=${String(ac.value)}`}
                            size="small"
                            variant="outlined"
                            color="info"
                            sx={{ height: 22, fontSize: "0.75rem" }}
                          />
                        );
                      })}
                    </Box>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
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

          {/* Attribute Changes Section — grouped by entity */}
          <Divider sx={{ mt: 1 }} />
          <Typography variant="subtitle2">属性变更</Typography>

          {groupedAttrChanges.map((group) => {
            const entity = entityOptions.find((e) => e.id === group.entityId);
            const isChar = group.entityType === "character";
            return (
              <Paper
                key={group.entityId}
                variant="outlined"
                sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
              >
                {/* Entity header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {isChar ? (
                    <PersonIcon fontSize="small" color="primary" />
                  ) : (
                    <PlaceIcon fontSize="small" color="secondary" />
                  )}
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {entity?.name ?? group.entityId.slice(0, 10)}
                  </Typography>
                  <Chip
                    label={isChar ? "角色" : "事物"}
                    size="small"
                    color={isChar ? "primary" : "secondary"}
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.7rem" }}
                  />
                  <Tooltip title="移除该实体的所有变更">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeEntityGroup(group.entityId)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Attribute rows */}
                {group.changes.map((ch) => {
                  const selectedAttrDef = attrDefs?.find((d) => d.name === ch.attribute);
                  return (
                    <Box
                      key={ch.flatIdx}
                      sx={{ display: "flex", gap: 1, alignItems: "center", pl: 3 }}
                    >
                      {/* Attribute selector */}
                      <TextField
                        size="small"
                        label="属性"
                        select
                        slotProps={{ inputLabel: { htmlFor: undefined } }}
                        value={ch.attribute}
                        onChange={(e) => {
                          const def = attrDefs?.find((d) => d.name === e.target.value);
                          let defaultValue: string | number | boolean = "";
                          if (def?.type === "number") defaultValue = 0;
                          if (def?.type === "boolean") defaultValue = false;
                          if (def?.type === "enum") defaultValue = def.enumValues?.[0] ?? "";
                          updateAttrRow(ch.flatIdx, { attribute: e.target.value, value: defaultValue });
                        }}
                        sx={{ minWidth: 140 }}
                      >
                        {(attrDefs ?? []).map((d) => (
                          <MenuItem key={d.id} value={d.name}>
                            {d.name}
                          </MenuItem>
                        ))}
                      </TextField>

                      {/* Value input — adapts to attribute type */}
                      {selectedAttrDef?.type === "boolean" ? (
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={ch.value === true}
                              onChange={(e) =>
                                updateAttrRow(ch.flatIdx, { value: e.target.checked })
                              }
                            />
                          }
                          label={ch.value ? "是" : "否"}
                          sx={{ minWidth: 80 }}
                        />
                      ) : selectedAttrDef?.type === "enum" ? (
                        <TextField
                          size="small"
                          label="值"
                          select
                          slotProps={{ inputLabel: { htmlFor: undefined } }}
                          value={ch.value}
                          onChange={(e) =>
                            updateAttrRow(ch.flatIdx, { value: e.target.value })
                          }
                          sx={{ minWidth: 120 }}
                        >
                          {(selectedAttrDef.enumValues ?? []).map((v) => (
                            <MenuItem key={v} value={v}>
                              {v}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : selectedAttrDef?.type === "number" ? (
                        <TextField
                          size="small"
                          label="值"
                          type="number"
                          value={ch.value}
                          onChange={(e) =>
                            updateAttrRow(ch.flatIdx, { value: Number(e.target.value) })
                          }
                          sx={{ minWidth: 100 }}
                        />
                      ) : (
                        <TextField
                          size="small"
                          label="值"
                          value={ch.value}
                          onChange={(e) =>
                            updateAttrRow(ch.flatIdx, { value: e.target.value })
                          }
                          sx={{ minWidth: 120, flex: 1 }}
                        />
                      )}

                      {/* Remove single attribute row */}
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeAttrRow(ch.flatIdx)}
                      >
                        <RemoveCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}

                {/* Add attribute button within group */}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addAttrToGroup(group.entityId, group.entityType)}
                  sx={{ alignSelf: "flex-start", ml: 3 }}
                >
                  添加属性
                </Button>
              </Paper>
            );
          })}

          {/* Add entity picker */}
          <Autocomplete
            size="small"
            options={entityOptions.filter(
              (e) => !groupedAttrChanges.some((g) => g.entityId === e.id),
            )}
            groupBy={(o) => (o.type === "character" ? "角色" : "事物")}
            getOptionLabel={(o) => o.name}
            value={null}
            onChange={(_, v) => {
              if (v) addEntityGroup(v);
            }}
            renderInput={(params) => (
              <TextField {...params} label="添加实体" placeholder="选择角色或事物" />
            )}
            blurOnSelect
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
