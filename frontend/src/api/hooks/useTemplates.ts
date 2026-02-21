import type {
  CreateTemplateBody,
  CreateWorldFromTemplateBody,
  UpdateTemplateBody,
  World,
  WorldTemplate,
} from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<WorldTemplate[]>("/templates"),
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ["templates", templateId],
    queryFn: () => api.get<WorldTemplate>(`/templates/${templateId}`),
    enabled: !!templateId,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateBody) =>
      api.post<WorldTemplate>("/templates", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTemplateBody) =>
      api.put<WorldTemplate>(`/templates/${templateId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["templates", templateId] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.delete(`/templates/${templateId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useSaveWorldAsTemplate(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateBody) =>
      api.post<WorldTemplate>(`/worlds/${worldId}/save-as-template`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useCreateWorldFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      body,
    }: {
      templateId: string;
      body: CreateWorldFromTemplateBody;
    }) => api.post<World>(`/templates/${templateId}/create-world`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["worlds"] }),
  });
}
