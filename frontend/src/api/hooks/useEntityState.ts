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
) {
  return useQuery<EntityState>({
    queryKey: ["entityState", worldId, entityId, time],
    queryFn: () =>
      api.get(`/worlds/${worldId}/entities/${entityId}/state?time=${time}`),
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
) {
  const ids = entityIds ?? [];
  const enabled = !!worldId && ids.length > 0 && time != null;

  return useQuery<EntityState[]>({
    queryKey: ["entitiesState", worldId, ids, time],
    queryFn: async () => {
      const results = await Promise.all(
        ids.map((id) =>
          api.get<EntityState>(
            `/worlds/${worldId}/entities/${id}/state?time=${time}`,
          ),
        ),
      );
      return results;
    },
    enabled,
  });
}
