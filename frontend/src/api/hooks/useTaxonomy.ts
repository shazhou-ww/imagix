import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TaxonomyNode,
  TaxonomyTree,
  CreateTaxonomyNodeBody,
  UpdateTaxonomyNodeBody,
} from "@imagix/shared";
import { api } from "../client";

export const taxonomyKeys = {
  all: (worldId: string) => ["taxonomy", worldId] as const,
  tree: (worldId: string, tree: TaxonomyTree) =>
    ["taxonomy", worldId, tree] as const,
};

export function useTaxonomyTree(worldId?: string, tree?: TaxonomyTree) {
  return useQuery<TaxonomyNode[]>({
    queryKey: taxonomyKeys.tree(worldId!, tree!),
    queryFn: () => api.get(`/worlds/${worldId}/taxonomy/${tree}`),
    enabled: !!worldId && !!tree,
  });
}

export function useCreateTaxonomyNode(worldId: string, tree: TaxonomyTree) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaxonomyNodeBody) =>
      api.post<TaxonomyNode>(`/worlds/${worldId}/taxonomy/${tree}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.tree(worldId, tree) }),
  });
}

export function useUpdateTaxonomyNode(worldId: string, tree: TaxonomyTree) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: UpdateTaxonomyNodeBody }) =>
      api.put<TaxonomyNode>(`/worlds/${worldId}/taxonomy/${tree}/${nodeId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.tree(worldId, tree) }),
  });
}

export function useDeleteTaxonomyNode(worldId: string, tree: TaxonomyTree) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      api.delete(`/worlds/${worldId}/taxonomy/${tree}/${nodeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.tree(worldId, tree) }),
  });
}
