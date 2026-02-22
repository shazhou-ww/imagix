import type { Event } from "@imagix/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

export const entityEventKeys = {
  all: (worldId: string, entityId: string) =>
    ["entityEvents", worldId, entityId] as const,
};

/**
 * 查询某实体的所有关联事件。
 * 使用后端 entity-events 接口：GET /worlds/:worldId/entities/:entityId/events
 */
export function useEntityEvents(worldId?: string, entityId?: string) {
  return useQuery<Event[]>({
    queryKey: entityEventKeys.all(worldId ?? "", entityId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/entities/${entityId}/events`),
    enabled: !!worldId && !!entityId,
  });
}
