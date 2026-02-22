import type { AttributeDefinition } from "@imagix/shared";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAttributeDefinitions } from "@/api/hooks/useAttributeDefinitions";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useEventLinks } from "@/api/hooks/useEventLinks";
import { useDeleteEvent, useEvent } from "@/api/hooks/useEvents";
import { usePlaces } from "@/api/hooks/usePlaces";
import { useRelationships } from "@/api/hooks/useRelationships";
import { useThings } from "@/api/hooks/useThings";
import ConfirmDialog from "@/components/ConfirmDialog";
import DetailPageHeader from "@/components/DetailPageHeader";
import EntityLink from "@/components/EntityLink";
import { formatDuration, formatEpochMs } from "@/utils/time";

export default function EventDetailPage() {
  const { worldId, eventId } = useParams<{
    worldId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useEvent(worldId, eventId);
  const { data: places } = usePlaces(worldId);
  const { data: characters } = useCharacters(worldId);
  const { data: things } = useThings(worldId);
  const { data: relationships } = useRelationships(worldId);
  const { data: eventLinks } = useEventLinks(worldId);
  const { data: attrDefs } = useAttributeDefinitions(worldId);
  const deleteEvent = useDeleteEvent(worldId ?? "");

  const [deleteOpen, setDeleteOpen] = useState(false);

  const placeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of places ?? []) map.set(p.id, p.name);
    return map;
  }, [places]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters ?? []) map.set(c.id, c.name);
    for (const t of things ?? []) map.set(t.id, t.name);
    return map;
  }, [characters, things]);

  const relMap = useMemo(() => {
    const map = new Map<string, { fromId: string; toId: string }>();
    for (const r of relationships ?? [])
      map.set(r.id, { fromId: r.fromId, toId: r.toId });
    return map;
  }, [relationships]);

  const attrDefMap = useMemo(() => {
    const map = new Map<string, AttributeDefinition>();
    for (const ad of attrDefs ?? []) map.set(ad.name, ad);
    return map;
  }, [attrDefs]);

  // Find linked events
  const linkedEvents = useMemo(() => {
    if (!eventLinks || !eventId) return [];
    return eventLinks
      .filter((l) => l.eventIdA === eventId || l.eventIdB === eventId)
      .map((l) => ({
        linkedEventId: l.eventIdA === eventId ? l.eventIdB : l.eventIdA,
        description: l.description,
      }));
  }, [eventLinks, eventId]);

  // Collect all participant entity IDs from impacts
  const participantIds = useMemo(() => {
    if (!event)
      return { characterIds: new Set<string>(), thingIds: new Set<string>() };
    const charIds = new Set<string>();
    const thingIds = new Set<string>();
    for (const ac of event.impacts?.attributeChanges ?? []) {
      if (ac.entityId.startsWith("chr")) charIds.add(ac.entityId);
      else if (ac.entityId.startsWith("thg")) thingIds.add(ac.entityId);
    }
    return { characterIds: charIds, thingIds };
  }, [event]);

  if (!worldId || !eventId) return null;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!event) {
    return <Navigate to={`/worlds/${worldId}/events`} replace />;
  }

  const handleDelete = () => {
    deleteEvent.mutate(event.id, {
      onSuccess: () => navigate(`/worlds/${worldId}/events`),
    });
  };

  const attrChanges = event.impacts?.attributeChanges ?? [];
  const relAttrChanges = event.impacts?.relationshipAttributeChanges ?? [];
  const hasImpacts = attrChanges.length > 0 || relAttrChanges.length > 0;

  // Event type label
  const systemLabel = event.system
    ? event.content.includes("诞生")
      ? "诞生事件"
      : event.content.includes("创建")
        ? "创建事件"
        : event.content.includes("消亡") || event.content.includes("死亡")
          ? "消亡事件"
          : event.content.includes("纪元")
            ? "纪元事件"
            : event.content.includes("建立")
              ? "建立事件"
              : "系统事件"
    : null;

  return (
    <Box>
      <DetailPageHeader
        breadcrumbs={[
          { label: "事件", to: `/worlds/${worldId}/events` },
          {
            label:
              event.content.length > 20
                ? `${event.content.slice(0, 20)}…`
                : event.content,
          },
        ]}
        title={
          event.content.length > 40
            ? `${event.content.slice(0, 40)}…`
            : event.content
        }
        status={
          systemLabel ? { label: systemLabel, color: "warning" } : undefined
        }
        actions={
          <>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/worlds/${worldId}/events#${event.id}`)}
              disabled={event.system}
            >
              编辑
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
              disabled={event.system}
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

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              时间
            </Typography>
            <Typography variant="body1">{formatEpochMs(event.time)}</Typography>
          </Box>

          {event.duration > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                持续时间
              </Typography>
              <Typography variant="body1">
                {formatDuration(event.duration)}
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">
              地点
            </Typography>
            {event.placeId ? (
              <Box sx={{ mt: 0.5 }}>
                <EntityLink
                  entityId={event.placeId}
                  worldId={worldId}
                  label={placeMap.get(event.placeId)}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.disabled">
                无明确地点
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              内容
            </Typography>
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
            >
              {event.content}
            </Typography>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            ID: {event.id}
          </Typography>
        </Box>
      </Paper>

      {/* State Impacts */}
      {hasImpacts && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            状态影响
          </Typography>

          {attrChanges.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="caption"
                fontWeight="bold"
                color="text.secondary"
                sx={{ mb: 1, display: "block" }}
              >
                实体属性变更
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>实体</TableCell>
                    <TableCell>属性</TableCell>
                    <TableCell>值</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attrChanges.map((ac, i) => (
                    <TableRow key={`${ac.entityId}-${ac.attribute}-${i}`}>
                      <TableCell>
                        <EntityLink
                          entityId={ac.entityId}
                          worldId={worldId}
                          label={entityNameMap.get(ac.entityId)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {attrDefMap.get(ac.attribute)?.name ?? ac.attribute}
                      </TableCell>
                      <TableCell>
                        {formatValue(ac.value, ac.attribute, attrDefMap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {relAttrChanges.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                fontWeight="bold"
                color="text.secondary"
                sx={{ mb: 1, display: "block" }}
              >
                关系属性变更
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>关系</TableCell>
                    <TableCell>方向</TableCell>
                    <TableCell>属性</TableCell>
                    <TableCell>值</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {relAttrChanges.map((rac, i) => {
                    const rel = relMap.get(rac.relationshipId);
                    return (
                      <TableRow
                        key={`${rac.relationshipId}-${rac.attribute}-${rac.direction}-${i}`}
                      >
                        <TableCell>
                          {rel ? (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              <EntityLink
                                entityId={rel.fromId}
                                worldId={worldId}
                                label={entityNameMap.get(rel.fromId)}
                                size="small"
                              />
                              <Typography variant="caption">→</Typography>
                              <EntityLink
                                entityId={rel.toId}
                                worldId={worldId}
                                label={entityNameMap.get(rel.toId)}
                                size="small"
                              />
                            </Box>
                          ) : (
                            <EntityLink
                              entityId={rac.relationshipId}
                              worldId={worldId}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              rac.direction === "from_to" ? "正向" : "反向"
                            }
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.7rem" }}
                          />
                        </TableCell>
                        <TableCell>
                          {attrDefMap.get(rac.attribute)?.name ?? rac.attribute}
                        </TableCell>
                        <TableCell>
                          {formatValue(rac.value, rac.attribute, attrDefMap)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      )}

      {/* Participants */}
      {(participantIds.characterIds.size > 0 ||
        participantIds.thingIds.size > 0) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            参与实体
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              alignItems: "center",
            }}
          >
            {participantIds.characterIds.size > 0 && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mr: 0.5 }}
                >
                  角色:
                </Typography>
                {[...participantIds.characterIds].map((id) => (
                  <EntityLink
                    key={id}
                    entityId={id}
                    worldId={worldId}
                    label={entityNameMap.get(id)}
                  />
                ))}
              </>
            )}
            {participantIds.thingIds.size > 0 && (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mr: 0.5, ml: 1 }}
                >
                  事物:
                </Typography>
                {[...participantIds.thingIds].map((id) => (
                  <EntityLink
                    key={id}
                    entityId={id}
                    worldId={worldId}
                    label={entityNameMap.get(id)}
                  />
                ))}
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* Linked Events */}
      {linkedEvents.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            关联事件
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {linkedEvents.map((le) => (
              <Card
                key={le.linkedEventId}
                variant="outlined"
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() =>
                  navigate(`/worlds/${worldId}/events/${le.linkedEventId}`)
                }
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2">↔</Typography>
                    <EntityLink
                      entityId={le.linkedEventId}
                      worldId={worldId}
                      size="small"
                    />
                    {le.description && (
                      <Typography variant="caption" color="text.secondary">
                        {le.description}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Paper>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="删除事件"
        message={`确定要删除此事件吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={deleteEvent.isPending}
      />
    </Box>
  );
}

function formatValue(
  value: string | number | boolean,
  attribute: string,
  attrDefMap: Map<string, AttributeDefinition>,
): React.ReactNode {
  if (typeof value === "boolean") {
    return (
      <Chip
        label={value ? "是" : "否"}
        size="small"
        color={value ? "success" : "default"}
        sx={{ height: 20 }}
      />
    );
  }
  const def = attrDefMap.get(attribute);
  if (def?.type === "timestamp" && typeof value === "number") {
    return formatEpochMs(value);
  }
  if (def?.type === "timespan" && typeof value === "number") {
    return formatDuration(value);
  }
  return String(value);
}
