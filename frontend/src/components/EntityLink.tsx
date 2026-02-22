import { Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useCharacters } from "@/api/hooks/useCharacters";
import { useEvents } from "@/api/hooks/useEvents";
import { usePlaces } from "@/api/hooks/usePlaces";
import { useRelationships } from "@/api/hooks/useRelationships";
import { useStories } from "@/api/hooks/useStories";
import { useThings } from "@/api/hooks/useThings";

type EntityType =
  | "character"
  | "thing"
  | "place"
  | "relationship"
  | "event"
  | "story"
  | "attribute"
  | "taxonomy"
  | "unknown";

const PREFIX_MAP: Record<string, EntityType> = {
  chr: "character",
  thg: "thing",
  plc: "place",
  rel: "relationship",
  evt: "event",
  sty: "story",
  adf: "attribute",
  txn: "taxonomy",
};

const ROUTE_MAP: Record<EntityType, string> = {
  character: "characters",
  thing: "things",
  place: "places",
  relationship: "relationships",
  event: "events",
  story: "stories",
  attribute: "attributes",
  taxonomy: "taxonomy",
  unknown: "",
};

const COLOR_MAP: Record<
  EntityType,
  "primary" | "secondary" | "success" | "warning" | "info" | "error" | "default"
> = {
  character: "primary",
  thing: "secondary",
  place: "success",
  relationship: "warning",
  event: "info",
  story: "default",
  attribute: "default",
  taxonomy: "default",
  unknown: "default",
};

function getEntityType(id: string): EntityType {
  const prefix = id.substring(0, 3);
  return PREFIX_MAP[prefix] ?? "unknown";
}

interface EntityLinkProps {
  /** 实体 ID（根据前缀自动判断类型和路由） */
  entityId: string;
  /** 所属世界 ID */
  worldId: string;
  /** 覆盖显示名称（不提供则自动查找） */
  label?: string;
  /** 展示样式 */
  variant?: "chip" | "text";
  /** 芯片尺寸 */
  size?: "small" | "medium";
}

/**
 * 通用实体链接组件。
 * 根据实体 ID 前缀自动判断类型，生成可点击的链接跳转到详情页。
 */
export default function EntityLink({
  entityId,
  worldId,
  label,
  variant = "chip",
  size = "small",
}: EntityLinkProps) {
  const navigate = useNavigate();
  const entityType = getEntityType(entityId);

  // Conditionally fetch names for label resolution
  const { data: characters } = useCharacters(
    !label && entityType === "character" ? worldId : undefined,
  );
  const { data: things } = useThings(
    !label && entityType === "thing" ? worldId : undefined,
  );
  const { data: places } = usePlaces(
    !label && entityType === "place" ? worldId : undefined,
  );
  const { data: events } = useEvents(
    !label && entityType === "event" ? worldId : undefined,
  );
  const { data: relationships } = useRelationships(
    !label && entityType === "relationship" ? worldId : undefined,
  );
  const { data: stories } = useStories(
    !label && entityType === "story" ? worldId : undefined,
  );

  const resolvedLabel = (() => {
    if (label) return label;
    switch (entityType) {
      case "character":
        return characters?.find((c) => c.id === entityId)?.name ?? entityId;
      case "thing":
        return things?.find((t) => t.id === entityId)?.name ?? entityId;
      case "place":
        return places?.find((p) => p.id === entityId)?.name ?? entityId;
      case "event": {
        const evt = events?.find((e) => e.id === entityId);
        return evt
          ? evt.content.length > 20
            ? `${evt.content.slice(0, 20)}…`
            : evt.content
          : entityId;
      }
      case "relationship":
        return relationships?.find((r) => r.id === entityId)?.id ?? entityId;
      case "story":
        return stories?.find((s) => s.id === entityId)?.title ?? entityId;
      default:
        return entityId;
    }
  })();

  const handleClick = () => {
    const route = ROUTE_MAP[entityType];
    if (route && entityType !== "unknown") {
      navigate(`/worlds/${worldId}/${route}/${entityId}`);
    }
  };

  if (variant === "chip") {
    return (
      <Chip
        label={resolvedLabel}
        size={size}
        color={COLOR_MAP[entityType]}
        variant="outlined"
        onClick={handleClick}
        sx={{ cursor: "pointer", maxWidth: 200 }}
      />
    );
  }

  return (
    <a
      href={`/worlds/${worldId}/${ROUTE_MAP[entityType]}/${entityId}`}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
      style={{
        cursor: "pointer",
        color: "var(--mui-palette-primary-main, #1976d2)",
        textDecoration: "underline",
      }}
    >
      {resolvedLabel}
    </a>
  );
}

export { getEntityType, ROUTE_MAP, type EntityType };
