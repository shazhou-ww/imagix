import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

export interface EntityState {
  entityId: string;
  time: number;
  attributes: Record<string, string | number | boolean>;
}

export function useEntityState(
  worldId?: string,
  entityId?: string,
  time?: number,
  forEvent?: string,
) {
  return useQuery<EntityState>({
    queryKey: ["entityState", worldId, entityId, time, forEvent],
    queryFn: () => {
      let url = `/worlds/${worldId}/entities/${entityId}/state?time=${time}`;
      if (forEvent) url += `&forEvent=${forEvent}`;
      return api.get(url);
    },
    enabled: !!worldId && !!entityId && time != null,
  });
}

/**
 * Batch fetch state for multiple entities at a given time.
 * Uses individual queries under the hood (React Query handles dedup).
 */
export function useEntitiesState(
  worldId?: string,
  entityIds?: string[],
  time?: number,
  forEvent?: string,
) {
  const ids = entityIds ?? [];
  const enabled = !!worldId && ids.length > 0 && time != null;

  return useQuery<EntityState[]>({
    queryKey: ["entitiesState", worldId, ids, time, forEvent],
    queryFn: async () => {
      const results = await Promise.all(
        ids.map((id) => {
          let url = `/worlds/${worldId}/entities/${id}/state?time=${time}`;
          if (forEvent) url += `&forEvent=${forEvent}`;
          return api.get<EntityState>(url);
        }),
      );
      return results;
    },
    enabled,
  });
}
