import type { CreateEventBody, Event, UpdateEventBody } from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export const eventKeys = {
  all: (worldId: string) => ["events", worldId] as const,
  detail: (worldId: string, id: string) => ["events", worldId, id] as const,
};

export function useEvents(worldId?: string) {
  return useQuery<Event[]>({
    queryKey: eventKeys.all(worldId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/events`),
    enabled: !!worldId,
  });
}

export function useEvent(worldId?: string, eventId?: string) {
  return useQuery<Event>({
    queryKey: eventKeys.detail(worldId ?? "", eventId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/events/${eventId}`),
    enabled: !!worldId && !!eventId,
  });
}

export function useCreateEvent(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventBody) =>
      api.post<Event>(`/worlds/${worldId}/events`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all(worldId) }),
  });
}

export function useUpdateEvent(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      body,
    }: {
      eventId: string;
      body: UpdateEventBody;
    }) => api.put<Event>(`/worlds/${worldId}/events/${eventId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all(worldId) }),
  });
}

export function useDeleteEvent(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.delete(`/worlds/${worldId}/events/${eventId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all(worldId) }),
  });
}
