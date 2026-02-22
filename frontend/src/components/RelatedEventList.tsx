import type { Event as WorldEvent } from "@imagix/shared";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEntityEvents } from "@/api/hooks/useEntityEvents";
import { usePlaces } from "@/api/hooks/usePlaces";
import { formatEpochMs } from "@/utils/time";

interface RelatedEventListProps {
  worldId: string;
  entityId: string;
  /** 默认显示条数 */
  maxItems?: number;
}

/**
 * 关联事件时间线组件。
 * 展示某实体的所有关联事件，按时间排序。
 */
export default function RelatedEventList({
  worldId,
  entityId,
  maxItems = 10,
}: RelatedEventListProps) {
  const { data: events, isLoading } = useEntityEvents(worldId, entityId);
  const { data: places } = usePlaces(worldId);
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const placeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of places ?? []) map.set(p.id, p.name);
    return map;
  }, [places]);

  const sortedEvents = useMemo(
    () => [...(events ?? [])].sort((a, b) => a.time - b.time),
    [events],
  );

  const displayEvents = showAll
    ? sortedEvents
    : sortedEvents.slice(0, maxItems);
  const hasMore = sortedEvents.length > maxItems;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!sortedEvents.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        暂无相关事件
      </Typography>
    );
  }

  return (
    <Box>
      {displayEvents.map((evt, index) => (
        <EventTimelineItem
          key={evt.id}
          event={evt}
          placeName={evt.placeId ? placeMap.get(evt.placeId) : undefined}
          isLast={index === displayEvents.length - 1}
          onClick={() => navigate(`/worlds/${worldId}/events/${evt.id}`)}
        />
      ))}
      {hasMore && !showAll && (
        <Button
          size="small"
          startIcon={<ExpandMoreIcon />}
          onClick={() => setShowAll(true)}
          sx={{ mt: 1 }}
        >
          查看全部 {sortedEvents.length} 个事件
        </Button>
      )}
    </Box>
  );
}

function EventTimelineItem({
  event,
  placeName,
  isLast,
  onClick,
}: {
  event: WorldEvent;
  placeName?: string;
  isLast: boolean;
  onClick: () => void;
}) {
  const impactCount =
    (event.impacts?.attributeChanges?.length ?? 0) +
    (event.impacts?.relationshipAttributeChanges?.length ?? 0);

  return (
    <Box sx={{ display: "flex", gap: 2, position: "relative" }}>
      {/* Timeline connector */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 20,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: event.system ? "warning.main" : "primary.main",
            mt: 1.5,
            flexShrink: 0,
          }}
        />
        {!isLast && (
          <Box
            sx={{
              width: 2,
              flex: 1,
              bgcolor: "divider",
              minHeight: 16,
            }}
          />
        )}
      </Box>

      {/* Event card */}
      <Card
        variant="outlined"
        sx={{
          flex: 1,
          mb: 1.5,
          cursor: "pointer",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
        }}
        onClick={onClick}
      >
        <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="caption" fontWeight="bold" color="primary">
              {formatEpochMs(event.time)}
            </Typography>
            {event.duration > 0 && (
              <Typography variant="caption" color="text.secondary">
                (持续 {formatDurationBrief(event.duration)})
              </Typography>
            )}
            {event.system && (
              <Chip
                label="系统"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 18, fontSize: "0.7rem" }}
              />
            )}
            {placeName && (
              <Chip
                label={placeName}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: "0.7rem" }}
              />
            )}
            {impactCount > 0 && (
              <Chip
                label={`${impactCount} 项变更`}
                size="small"
                variant="outlined"
                color="info"
                sx={{ height: 18, fontSize: "0.7rem" }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {event.content}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

/** 简短的持续时间格式化 */
function formatDurationBrief(ms: number): string {
  const abs = Math.abs(ms);
  const MS_PER_YEAR = 12 * 30 * 24 * 60 * 60 * 1000;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MS_PER_HOUR = 60 * 60 * 1000;

  if (abs >= MS_PER_YEAR) return `${Math.floor(abs / MS_PER_YEAR)}年`;
  if (abs >= MS_PER_DAY) return `${Math.floor(abs / MS_PER_DAY)}天`;
  if (abs >= MS_PER_HOUR) return `${Math.floor(abs / MS_PER_HOUR)}小时`;
  return `${Math.floor(abs / 60000)}分钟`;
}
