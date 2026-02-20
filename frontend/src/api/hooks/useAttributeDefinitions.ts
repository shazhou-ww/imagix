import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AttributeDefinition,
  CreateAttributeDefinitionBody,
  UpdateAttributeDefinitionBody,
} from "@imagix/shared";
import { api } from "../client";

export const attributeDefinitionKeys = {
  all: (worldId: string) => ["attribute-definitions", worldId] as const,
};

export function useAttributeDefinitions(worldId?: string) {
  return useQuery<AttributeDefinition[]>({
    queryKey: attributeDefinitionKeys.all(worldId!),
    queryFn: () => api.get(`/worlds/${worldId}/attribute-definitions`),
    enabled: !!worldId,
  });
}

export function useCreateAttributeDefinition(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAttributeDefinitionBody) =>
      api.post<AttributeDefinition>(
        `/worlds/${worldId}/attribute-definitions`,
        body,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: attributeDefinitionKeys.all(worldId),
      }),
  });
}

export function useUpdateAttributeDefinition(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      adfId,
      body,
    }: {
      adfId: string;
      body: UpdateAttributeDefinitionBody;
    }) =>
      api.put<AttributeDefinition>(
        `/worlds/${worldId}/attribute-definitions/${adfId}`,
        body,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: attributeDefinitionKeys.all(worldId),
      }),
  });
}

export function useDeleteAttributeDefinition(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adfId: string) =>
      api.delete(`/worlds/${worldId}/attribute-definitions/${adfId}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: attributeDefinitionKeys.all(worldId),
      }),
  });
}
