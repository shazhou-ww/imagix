import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventLink, CreateEventLinkBody, DeleteEventLinkBody } from "@imagix/shared";
import { api } from "../client";

export const eventLinkKeys = {
  all: (worldId: string) => ["eventLinks", worldId] as const,
};

export function useEventLinks(worldId?: string) {
  return useQuery<EventLink[]>({
    queryKey: eventLinkKeys.all(worldId!),
    queryFn: () => api.get(`/worlds/${worldId}/event-links`),
    enabled: !!worldId,
  });
}

export function useCreateEventLink(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventLinkBody) =>
      api.post<EventLink>(`/worlds/${worldId}/event-links`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: eventLinkKeys.all(worldId) }),
  });
}

export function useDeleteEventLink(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeleteEventLinkBody) =>
      api.delete(`/worlds/${worldId}/event-links`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: eventLinkKeys.all(worldId) }),
  });
}
