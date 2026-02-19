import type { CreateWorldBody, UpdateWorldBody, World } from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export function useWorlds() {
  return useQuery({
    queryKey: ["worlds"],
    queryFn: () => api.get<World[]>("/worlds"),
  });
}

export function useWorld(worldId: string | undefined) {
  return useQuery({
    queryKey: ["worlds", worldId],
    queryFn: () => api.get<World>(`/worlds/${worldId}`),
    enabled: !!worldId,
  });
}

export function useCreateWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorldBody) => api.post<World>("/worlds", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worlds"] }),
  });
}

export function useUpdateWorld(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorldBody) =>
      api.put<World>(`/worlds/${worldId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worlds"] });
      qc.invalidateQueries({ queryKey: ["worlds", worldId] });
    },
  });
}

export function useDeleteWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (worldId: string) => api.delete(`/worlds/${worldId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worlds"] }),
  });
}
