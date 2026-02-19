import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character, CreateCharacterBody, UpdateCharacterBody } from "@imagix/shared";
import { api } from "../client";

export const characterKeys = {
  all: (worldId: string) => ["characters", worldId] as const,
  detail: (worldId: string, id: string) => ["characters", worldId, id] as const,
};

export function useCharacters(worldId?: string) {
  return useQuery<Character[]>({
    queryKey: characterKeys.all(worldId!),
    queryFn: () => api.get(`/worlds/${worldId}/characters`),
    enabled: !!worldId,
  });
}

export function useCharacter(worldId?: string, charId?: string) {
  return useQuery<Character>({
    queryKey: characterKeys.detail(worldId!, charId!),
    queryFn: () => api.get(`/worlds/${worldId}/characters/${charId}`),
    enabled: !!worldId && !!charId,
  });
}

export function useCreateCharacter(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCharacterBody) =>
      api.post<Character>(`/worlds/${worldId}/characters`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all(worldId) }),
  });
}

export function useUpdateCharacter(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ charId, body }: { charId: string; body: UpdateCharacterBody }) =>
      api.put<Character>(`/worlds/${worldId}/characters/${charId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all(worldId) }),
  });
}

export function useDeleteCharacter(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (charId: string) =>
      api.delete(`/worlds/${worldId}/characters/${charId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all(worldId) }),
  });
}
