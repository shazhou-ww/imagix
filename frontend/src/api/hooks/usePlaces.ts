import type { CreatePlaceBody, Place, UpdatePlaceBody } from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export const placeKeys = {
  all: (worldId: string) => ["places", worldId] as const,
  detail: (worldId: string, id: string) => ["places", worldId, id] as const,
};

export function usePlaces(worldId?: string) {
  return useQuery<Place[]>({
    queryKey: placeKeys.all(worldId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/places`),
    enabled: !!worldId,
  });
}

export function usePlace(worldId?: string, placeId?: string) {
  return useQuery<Place>({
    queryKey: placeKeys.detail(worldId ?? "", placeId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/places/${placeId}`),
    enabled: !!worldId && !!placeId,
  });
}

export function useCreatePlace(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlaceBody) =>
      api.post<Place>(`/worlds/${worldId}/places`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: placeKeys.all(worldId) }),
  });
}

export function useUpdatePlace(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      placeId,
      body,
    }: {
      placeId: string;
      body: UpdatePlaceBody;
    }) => api.put<Place>(`/worlds/${worldId}/places/${placeId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: placeKeys.all(worldId) }),
  });
}

export function useDeletePlace(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (placeId: string) =>
      api.delete(`/worlds/${worldId}/places/${placeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: placeKeys.all(worldId) }),
  });
}
