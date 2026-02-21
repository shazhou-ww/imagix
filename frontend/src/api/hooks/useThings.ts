import type {
  CreateThingBody,
  EndEntityBody,
  Thing,
  UpdateThingBody,
} from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { eventKeys } from "./useEvents";

export const thingKeys = {
  all: (worldId: string) => ["things", worldId] as const,
  detail: (worldId: string, id: string) => ["things", worldId, id] as const,
};

export function useThings(worldId?: string) {
  return useQuery<Thing[]>({
    queryKey: thingKeys.all(worldId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/things`),
    enabled: !!worldId,
  });
}

export function useThing(worldId?: string, thingId?: string) {
  return useQuery<Thing>({
    queryKey: thingKeys.detail(worldId ?? "", thingId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/things/${thingId}`),
    enabled: !!worldId && !!thingId,
  });
}

export function useCreateThing(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateThingBody) =>
      api.post<Thing>(`/worlds/${worldId}/things`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thingKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useUpdateThing(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      thingId,
      body,
    }: {
      thingId: string;
      body: UpdateThingBody;
    }) => api.put<Thing>(`/worlds/${worldId}/things/${thingId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: thingKeys.all(worldId) }),
  });
}

export function useDeleteThing(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thingId: string) =>
      api.delete(`/worlds/${worldId}/things/${thingId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thingKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useEndThing(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thingId, body }: { thingId: string; body: EndEntityBody }) =>
      api.post<Thing>(`/worlds/${worldId}/things/${thingId}/end`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thingKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useUndoEndThing(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thingId: string) =>
      api.delete<Thing>(`/worlds/${worldId}/things/${thingId}/end`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thingKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}
