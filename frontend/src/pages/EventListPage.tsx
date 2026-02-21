import type { Event as WorldEvent, AttributeChange } from "@imagix/shared";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { useEntitiesState } from "@/api/hooks/useEntityState";
import { useEventLinks } from "@/api/hooks/useEventLinks";
import ConfirmDialog from "@/components/ConfirmDialog";
import EpochTimeInput from "@/components/EpochTimeInput";
import EmptyState from "@/components/EmptyState";
import { formatDuration, parseEpochMs } from "@/utils/time";

/** Translate internal $age attribute to human-readable display name based on entity type. */
function displayAttrName(attrName: string, entityId: string): string {
  if (attrName !== "$age") return attrName;
  const prefix = entityId.slice(0, 3);
  if (prefix === "chr") return "年龄";
  if (prefix === "thg") return "存续时间";
  if (prefix === "rel") return "持续时间";
  return attrName;
}

// Group flat AttributeChange[] by entityId for grouped UI rendering
interface AttrChangeGroup {
  entityId: string;
  changes: { attribute: string; value: string | number | boolean; flatIdx: number }[];
}

function groupByEntity(changes: AttributeChange[]): AttrChangeGroup[] {
  const groups: AttrChangeGroup[] = [];
  const map = new Map<string, AttrChangeGroup>();
  changes.forEach((ac, idx) => {
    let group = map.get(ac.entityId);
    if (!group) {
      group = { entityId: ac.entityId, changes: [] };
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
  const [duration, setDuration] = useState<number>(0);
  const [content, setContent] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [attrChanges, setAttrChanges] = useState<AttributeChange[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<WorldEvent | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");
  const { data: eventLinks } = useEventLinks(worldId);

  // 编辑系统事件（创生/消亡）时的时序校验
  const timeError = useMemo(() => {
    if (!editingEvent?.system) return "";
    const affectedIds = [
      ...new Set(editingEvent.impacts?.attributeChanges?.map(ac => ac.entityId) ?? []),
    ];
    if (affectedIds.length === 0) return "";
    const isBirth = editingEvent.impacts?.attributeChanges?.some(
      (ac) => ac.attribute === "$alive" && ac.value === true,
    );
    const isEnd = editingEvent.impacts?.attributeChanges?.some(
      (ac) => ac.attribute === "$alive" && ac.value === false,
    );
    if (!isBirth && !isEnd) return "";

    for (const pid of affectedIds) {
      if (isBirth) {
        const endEvt = (events ?? []).find(
          (e) => e.id !== editingEvent.id && e.system &&
            e.impacts?.attributeChanges?.some((ac) => ac.entityId === pid && ac.attribute === "$alive" && ac.value === false),
        );
        if (endEvt && time >= endEvt.time) return "创生时间必须早于消亡时间";
      } else {
        const birthEvt = (events ?? []).find(
          (e) => e.id !== editingEvent.id && e.system &&
            e.impacts?.attributeChanges?.some((ac) => ac.entityId === pid && ac.attribute === "$alive" && ac.value === true),
        );
        if (birthEvt && time <= birthEvt.time) return "消亡时间必须晚于创生时间";
      }
    }
    return "";
  }, [editingEvent, time, events]);

  // Build entity options for autocomplete
  const entityOptions = useMemo(() => {
    const opts: { id: string; name: string; type: "character" | "thing" }[] = [];
    for (const c of characters ?? []) opts.push({ id: c.id, name: c.name, type: "character" });
    for (const t of things ?? []) opts.push({ id: t.id, name: t.name, type: "thing" });
    return opts;
  }, [characters, things]);

  // Fetch participant states at current event time, excluding the editing event itself
  const { data: participantStates } = useEntitiesState(
    dialogOpen ? worldId : undefined,
    dialogOpen ? participantIds : undefined,
    dialogOpen ? time : undefined,
    editingEvent?.id,
  );

  // Grouped view of attribute changes
  const groupedAttrChanges = useMemo(() => groupByEntity(attrChanges), [attrChanges]);

  const toggleExpand = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  // Add a participant (and optionally their attr change rows are added later)
  const addParticipant = useCallback(
    (entity: { id: string; type: "character" | "thing" }) => {
      setParticipantIds((prev) => prev.includes(entity.id) ? prev : [...prev, entity.id]);
    },
    [],
  );

  // Remove a participant and all their attribute changes
  const removeParticipant = useCallback(
    (entityId: string) => {
      setParticipantIds((prev) => prev.filter((id) => id !== entityId));
      setAttrChanges((prev) => prev.filter((ac) => ac.entityId !== entityId));
    },
    [],
  );

  // Toggle an attribute change on/off for a participant
  const toggleAttrChange = useCallback(
    (entityId: string, attrName: string, currentValue?: string | number | boolean) => {
      setAttrChanges((prev) => {
        const idx = prev.findIndex((ac) => ac.entityId === entityId && ac.attribute === attrName);
        if (idx >= 0) return prev.filter((_, i) => i !== idx);
        const def = attrDefs?.find((d) => d.name === attrName);
        let value: string | number | boolean = currentValue ?? "";
        if (value === "" || value === undefined) {
          if (def?.type === "number" || def?.type === "timestamp" || def?.type === "timespan") value = 0;
          else if (def?.type === "boolean") value = false;
          else if (def?.type === "enum") value = def.enumValues?.[0] ?? "";
        }
        return [...prev, { entityId, attribute: attrName, value }];
      });
    },
    [attrDefs],
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
    setDuration(0);
    setContent("");
    setParticipantIds([]);
    setAttrChanges([]);
    setSaveError("");
    setDialogOpen(true);
  };

  const openEdit = (evt: WorldEvent) => {
    setEditingEvent(evt);
    setTime(evt.time);
    setDuration(evt.duration ?? 0);
    setContent(evt.content);
    // Derive participant IDs from impacts
    const entityIds = [...new Set(evt.impacts?.attributeChanges?.map(ac => ac.entityId) ?? [])];
    setParticipantIds(entityIds);
    setAttrChanges(evt.impacts?.attributeChanges ?? []);
    setSaveError("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    // Filter out attribute changes where value is unchanged from current state
    // (participantStates already excludes the forEvent, so comparison is correct)
    const effectiveChanges = attrChanges.filter((ac) => {
      const state = participantStates?.find((s) => s.entityId === ac.entityId);
      const currentVal = state?.attributes?.[ac.attribute];
      // Keep if: no current value (new attribute), or value actually changed
      return currentVal === undefined || ac.value !== currentVal;
    });
    const impacts = {
      attributeChanges: effectiveChanges,
      relationshipAttributeChanges: editingEvent?.impacts?.relationshipAttributeChanges ?? [],
    };
    if (editingEvent) {
      updateEvent.mutate(
        { eventId: editingEvent.id, body: { time, duration, content: content.trim(), impacts } },
        {
          onSuccess: () => setDialogOpen(false),
          onError: (err) => setSaveError(err instanceof Error ? err.message : "操作失败"),
        },
      );
    } else {
      createEvent.mutate(
        { time, duration, content: content.trim(), impacts },
        {
          onSuccess: () => setDialogOpen(false),
          onError: (err) => setSaveError(err instanceof Error ? err.message : "操作失败"),
        },
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
                    width: 120,
                    px: 1.5,
                    py: 0.5,
                    bgcolor: "primary.50",
                    borderRadius: 1,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  {(() => {
                    const t = parseEpochMs(evt.time);
                    const prefix = evt.time < 0 ? "前" : "";
                    const dateLine = `${prefix}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
                    const timeLine = `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}`;
                    return (
                      <>
                        <Typography variant="body2" fontWeight="bold" color="primary.main" noWrap>
                          {dateLine}
                        </Typography>
                        <Typography variant="caption" color="primary.main">
                          {timeLine}
                        </Typography>
                        {evt.duration > 0 && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatDuration(evt.duration)}
                          </Typography>
                        )}
                      </>
                    );
                  })()}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body1">{evt.content}</Typography>
                    {evt.system && (
                      <Chip
                        label={(() => {
                          const acs = evt.impacts?.attributeChanges ?? [];
                          if (acs.length === 0) return "纪元";
                          const isBirth = acs.some(ac => ac.attribute === "$alive" && ac.value === true);
                          const isEnd = acs.some(ac => ac.attribute === "$alive" && ac.value === false);
                          const entityId = acs[0]?.entityId ?? "";
                          const entity = entityOptions.find(e => e.id === entityId);
                          const typeLabel = entityId.startsWith("chr") ? "角色" : entityId.startsWith("rel") ? "关系" : "事物";
                          const name = entity?.name ?? entityId.slice(0, 8);
                          if (isBirth) return `创生·${typeLabel}·${name}`;
                          if (isEnd) return `消亡·${typeLabel}·${name}`;
                          return "系统";
                        })()}
                        size="small"
                        color={(evt.impacts?.attributeChanges?.length ?? 0) === 0 ? "warning" : "info"}
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                    )}
                  </Box>
                  {(() => {
                    const entityIds = [...new Set(evt.impacts?.attributeChanges?.map(ac => ac.entityId) ?? [])];
                    if (entityIds.length === 0) return null;
                    return (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                        {entityIds.map((eid) => {
                          const entity = entityOptions.find((e) => e.id === eid);
                          return (
                            <Chip
                              key={eid}
                              label={entity?.name ?? eid.slice(0, 8)}
                              size="small"
                              variant="outlined"
                              color={entity?.type === "character" ? "primary" : "secondary"}
                              sx={{ height: 22, fontSize: "0.75rem" }}
                            />
                          );
                        })}
                      </Box>
                    );
                  })()}
                  {/* Summary counts for collapsed state */}
                  {!expandedEvents.has(evt.id) && (
                    <Box sx={{ display: "flex", gap: 1, mt: 0.5, alignItems: "center" }}>
                      {(evt.impacts?.attributeChanges?.length ?? 0) > 0 && (
                        <Chip
                          label={`${evt.impacts!.attributeChanges.length} 项状态变化`}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ height: 20, fontSize: "0.7rem", cursor: "pointer" }}
                          onClick={() => toggleExpand(evt.id)}
                        />
                      )}
                      {(() => {
                        const links = eventLinks?.filter(
                          (l) => l.eventIdA === evt.id || l.eventIdB === evt.id,
                        ) ?? [];
                        return links.length > 0 ? (
                          <Chip
                            label={`${links.length} 个关联`}
                            size="small"
                            variant="outlined"
                            color="default"
                            icon={<LinkIcon sx={{ fontSize: 14 }} />}
                            sx={{ height: 20, fontSize: "0.7rem", cursor: "pointer" }}
                            onClick={() => toggleExpand(evt.id)}
                          />
                        ) : null;
                      })()}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  {((evt.impacts?.attributeChanges?.length ?? 0) > 0 ||
                    (eventLinks?.some((l) => l.eventIdA === evt.id || l.eventIdB === evt.id) ?? false)) && (
                    <Tooltip title={expandedEvents.has(evt.id) ? "收起" : "展开详情"}>
                      <IconButton size="small" onClick={() => toggleExpand(evt.id)}>
                        {expandedEvents.has(evt.id) ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="编辑">
                    <IconButton size="small" onClick={() => openEdit(evt)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {!evt.system && (
                  <Tooltip title="删除">
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(evt)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  )}
                </Box>
              </CardContent>
              <Collapse in={expandedEvents.has(evt.id)} unmountOnExit>
                <Divider />
                <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                  {/* Attribute changes */}
                  {(evt.impacts?.attributeChanges?.length ?? 0) > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 0.5, display: "block" }}>
                        状态变化
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {evt.impacts!.attributeChanges.map((ac, i) => {
                          const entity = entityOptions.find((e) => e.id === ac.entityId);
                          const def = attrDefs?.find((d) => d.name === ac.attribute);
                          const displayValue = def?.type === "timespan" && typeof ac.value === "number"
                            ? formatDuration(ac.value)
                            : def?.type === "timestamp" && typeof ac.value === "number"
                              ? (() => { const t = parseEpochMs(ac.value); const p = ac.value < 0 ? "前" : ""; return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`; })()
                              : typeof ac.value === "boolean" ? (ac.value ? "是" : "否")
                              : String(ac.value);
                          return (
                            <Chip
                              key={`${ac.entityId}-${ac.attribute}-${i}`}
                              label={`${entity?.name ?? ac.entityId.slice(0, 8)}·${displayAttrName(ac.attribute, ac.entityId)}=${displayValue}`}
                              size="small"
                              variant="outlined"
                              color="info"
                              sx={{ height: 22, fontSize: "0.75rem" }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  {/* Event links */}
                  {(() => {
                    const links = eventLinks?.filter(
                      (l) => l.eventIdA === evt.id || l.eventIdB === evt.id,
                    ) ?? [];
                    if (links.length === 0) return null;
                    return (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 0.5, display: "block" }}>
                          事件关联
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {links.map((link) => {
                            const otherId = link.eventIdA === evt.id ? link.eventIdB : link.eventIdA;
                            const otherEvt = sortedEvents.find((e) => e.id === otherId);
                            const label = otherEvt
                              ? `${otherEvt.content.slice(0, 20)}${otherEvt.content.length > 20 ? "…" : ""}`
                              : otherId.slice(0, 8);
                            return (
                              <Chip
                                key={`${link.eventIdA}-${link.eventIdB}`}
                                icon={<LinkIcon sx={{ fontSize: 14 }} />}
                                label={link.description ? `${label}（${link.description}）` : label}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.75rem" }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })()}
                </Box>
              </Collapse>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {editingEvent ? "编辑事件" : "添加事件"}
          {editingEvent?.system && (
            <Chip
              label={(() => {
                const acs = editingEvent.impacts?.attributeChanges ?? [];
                if (acs.length === 0) return "纪元事件";
                const isBirth = acs.some(ac => ac.attribute === "$alive" && ac.value === true);
                const isEnd = acs.some(ac => ac.attribute === "$alive" && ac.value === false);
                const entityId = acs[0]?.entityId ?? "";
                const entity = entityOptions.find(e => e.id === entityId);
                const typeLabel = entityId.startsWith("chr") ? "角色" : entityId.startsWith("rel") ? "关系" : "事物";
                const name = entity?.name ?? entityId.slice(0, 8);
                if (isBirth) return `创生事件·${typeLabel}·${name}`;
                if (isEnd) return `消亡事件·${typeLabel}·${name}`;
                return "系统事件";
              })()}
              size="small"
              color={(editingEvent.impacts?.attributeChanges?.length ?? 0) === 0 ? "warning" : "info"}
              sx={{ height: 22, fontSize: "0.75rem" }}
            />
          )}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {saveError && <Alert severity="error" onClose={() => setSaveError("")}>{saveError}</Alert>}
          {timeError && <Alert severity="error">{timeError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                事件时间
              </Typography>
              <EpochTimeInput value={time} onChange={setTime} showPreview disabled={!!editingEvent?.system && (editingEvent.impacts?.attributeChanges?.length ?? 0) === 0} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                持续时间（留 0 表示瞬时事件）
              </Typography>
              <EpochTimeInput value={duration} onChange={setDuration} showPreview={false} showEraToggle={false} disabled={!!editingEvent?.system} />
              {duration > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  持续 {formatDuration(duration)}
                </Typography>
              )}
            </Box>
          </Box>

          <TextField
            label="事件内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            rows={4}
            required
          />

          {/* Participants & attribute changes */}
          <Divider sx={{ mt: 1 }} />
          <Typography variant="subtitle2">参与者与属性变更</Typography>

          {participantIds.map((pid) => {
            const entity = entityOptions.find((e) => e.id === pid);
            const isChar = entity?.type === "character";
            const group = groupedAttrChanges.find((g) => g.entityId === pid);
            const hasLockedRows = group?.changes.some(
              (ch) => attrDefs?.find((d) => d.name === ch.attribute)?.system,
            );
            const state = participantStates?.find((s) => s.entityId === pid);
            const stateAttrs = state?.attributes ?? {};

            // Only show attributes from current state + active changes
            const allAttrNames = [
              ...new Set([
                ...Object.keys(stateAttrs),
                ...(group?.changes ?? []).map((c) => c.attribute).filter(Boolean),
              ]),
            ];

            // Attributes not yet in the table — available to add
            const visibleSet = new Set(allAttrNames);
            const addableAttrs = (attrDefs ?? []).filter((d) => !visibleSet.has(d.name));

            return (
              <Paper
                key={pid}
                variant="outlined"
                sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
              >
                {/* Participant header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {isChar ? (
                    <PersonIcon fontSize="small" color="primary" />
                  ) : (
                    <PlaceIcon fontSize="small" color="secondary" />
                  )}
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    {entity?.name ?? pid.slice(0, 10)}
                  </Typography>
                  <Chip
                    label={isChar ? "角色" : "事物"}
                    size="small"
                    color={isChar ? "primary" : "secondary"}
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.7rem" }}
                  />
                  {!hasLockedRows && (
                    <Tooltip title="移除该参与者">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeParticipant(pid)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Attribute table */}
                {allAttrNames.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" />
                          <TableCell>属性</TableCell>
                          <TableCell>当前值</TableCell>
                          <TableCell>新值</TableCell>
                          <TableCell padding="checkbox" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allAttrNames.map((attrName) => {
                          const def = attrDefs?.find((d) => d.name === attrName);
                          const isLocked = !!def?.system;
                          const currentVal = stateAttrs[attrName];
                          const changeIdx = attrChanges.findIndex(
                            (ac) => ac.entityId === pid && ac.attribute === attrName,
                          );
                          const isChanging = changeIdx >= 0;
                          const changeVal = isChanging ? attrChanges[changeIdx].value : undefined;

                          const fmtVal = (v: unknown) => {
                            if (v === undefined || v === null) return "未设置";
                            if (def?.type === "timespan" && typeof v === "number") return formatDuration(v);
                            if (def?.type === "timestamp" && typeof v === "number") {
                              const t = parseEpochMs(v); const p = v < 0 ? "前" : "";
                              return `${p}${Math.abs(t.years) + 1}/${t.months + 1}/${t.days + 1}`;
                            }
                            if (typeof v === "boolean") return v ? "是" : "否";
                            return String(v);
                          };

                          return (
                            <TableRow
                              key={attrName}
                              sx={{ bgcolor: isChanging ? "action.selected" : undefined }}
                            >
                              <TableCell padding="checkbox">
                                <Checkbox
                                  size="small"
                                  checked={isChanging}
                                  disabled={isLocked}
                                  onChange={() =>
                                    toggleAttrChange(pid, attrName, currentVal)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={isChanging ? "bold" : "normal"}>
                                  {displayAttrName(attrName, pid)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {fmtVal(currentVal)}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ minWidth: 180 }}>
                                {isChanging && isLocked && (
                                  <Typography variant="body2" color="text.secondary">
                                    {fmtVal(changeVal)}
                                  </Typography>
                                )}
                                {isChanging && !isLocked && (
                                  (def?.type === "boolean" || typeof changeVal === "boolean") ? (
                                    <FormControlLabel
                                      control={
                                        <Switch
                                          size="small"
                                          checked={changeVal === true}
                                          onChange={(e) => updateAttrRow(changeIdx, { value: e.target.checked })}
                                        />
                                      }
                                      label={changeVal ? "是" : "否"}
                                    />
                                  ) : def?.type === "enum" ? (
                                    <TextField
                                      size="small"
                                      select
                                      fullWidth
                                      value={changeVal}
                                      slotProps={{ inputLabel: { htmlFor: undefined } }}
                                      onChange={(e) => updateAttrRow(changeIdx, { value: e.target.value })}
                                    >
                                      {(def.enumValues ?? []).map((v) => (
                                        <MenuItem key={v} value={v}>{v}</MenuItem>
                                      ))}
                                    </TextField>
                                  ) : def?.type === "timestamp" ? (
                                    <EpochTimeInput
                                      value={typeof changeVal === "number" ? changeVal : 0}
                                      onChange={(ms) => updateAttrRow(changeIdx, { value: ms })}
                                      size="small"
                                      showPreview
                                    />
                                  ) : def?.type === "timespan" ? (
                                    <EpochTimeInput
                                      value={typeof changeVal === "number" ? changeVal : 0}
                                      onChange={(ms) => updateAttrRow(changeIdx, { value: ms })}
                                      size="small"
                                      showPreview={false}
                                      showEraToggle={false}
                                    />
                                  ) : def?.type === "number" ? (
                                    <TextField
                                      size="small"
                                      type="number"
                                      fullWidth
                                      value={changeVal}
                                      onChange={(e) => updateAttrRow(changeIdx, { value: Number(e.target.value) })}
                                    />
                                  ) : (
                                    <TextField
                                      size="small"
                                      fullWidth
                                      value={changeVal}
                                      onChange={(e) => updateAttrRow(changeIdx, { value: e.target.value })}
                                    />
                                  )
                                )}
                              </TableCell>
                              {/* Delete row button (not for locked/system rows) */}
                              <TableCell padding="checkbox">
                                {!isLocked && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      // Remove the change if active, and remove from visible rows
                                      if (isChanging) {
                                        toggleAttrChange(pid, attrName, currentVal);
                                      }
                                      // If it came from current state, we can't truly delete it,
                                      // so only non-state rows disappear (changes-only rows)
                                    }}
                                    // Only show for rows that are purely from changes (not from current state)
                                    sx={{ visibility: currentVal === undefined ? "visible" : "hidden" }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {/* Add attribute row */}
                {addableAttrs.length > 0 && (
                  <Autocomplete
                    size="small"
                    options={addableAttrs}
                    getOptionLabel={(o) => o.name}
                    value={null}
                    onChange={(_, v) => {
                      if (v) toggleAttrChange(pid, v.name);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="添加属性" placeholder="选择属性" />
                    )}
                    blurOnSelect
                    sx={{ mt: 0.5, maxWidth: 300 }}
                  />
                )}

              </Paper>
            );
          })}

          {/* Add participant picker */}
          <Autocomplete
            size="small"
            options={entityOptions.filter(
              (e) => !participantIds.includes(e.id),
            )}
            groupBy={(o) => (o.type === "character" ? "角色" : "事物")}
            getOptionLabel={(o) => o.name}
            value={null}
            onChange={(_, v) => {
              if (v) addParticipant(v);
            }}
            renderInput={(params) => (
              <TextField {...params} label="添加参与者" placeholder="选择角色或事物" />
            )}
            blurOnSelect
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!content.trim() || createEvent.isPending || updateEvent.isPending || !!timeError}
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
