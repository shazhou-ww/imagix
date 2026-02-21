import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Relationship, CreateRelationshipBody, EndEntityBody } from "@imagix/shared";
import { api } from "../client";
import { eventKeys } from "./useEvents";

export const relationshipKeys = {
  all: (worldId: string) => ["relationships", worldId] as const,
  detail: (worldId: string, id: string) => ["relationships", worldId, id] as const,
  byEntity: (worldId: string, entityId: string) =>
    ["relationships", worldId, "entity", entityId] as const,
};

export function useRelationships(worldId?: string) {
  return useQuery<Relationship[]>({
    queryKey: relationshipKeys.all(worldId!),
    queryFn: () => api.get(`/worlds/${worldId}/relationships`),
    enabled: !!worldId,
  });
}

export function useRelationship(worldId?: string, relId?: string) {
  return useQuery<Relationship>({
    queryKey: relationshipKeys.detail(worldId!, relId!),
    queryFn: () => api.get(`/worlds/${worldId}/relationships/${relId}`),
    enabled: !!worldId && !!relId,
  });
}

export function useEntityRelationships(worldId?: string, entityId?: string) {
  return useQuery<Relationship[]>({
    queryKey: relationshipKeys.byEntity(worldId!, entityId!),
    queryFn: () =>
      api.get(`/worlds/${worldId}/entities/${entityId}/relationships`),
    enabled: !!worldId && !!entityId,
  });
}

export function useCreateRelationship(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRelationshipBody) =>
      api.post<Relationship>(`/worlds/${worldId}/relationships`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationshipKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useDeleteRelationship(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relId: string) =>
      api.delete(`/worlds/${worldId}/relationships/${relId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationshipKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useEndRelationship(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ relId, body }: { relId: string; body: EndEntityBody }) =>
      api.post<Relationship>(`/worlds/${worldId}/relationships/${relId}/end`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationshipKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}

export function useUndoEndRelationship(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (relId: string) =>
      api.delete<Relationship>(`/worlds/${worldId}/relationships/${relId}/end`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: relationshipKeys.all(worldId) });
      qc.invalidateQueries({ queryKey: eventKeys.all(worldId) });
    },
  });
}
