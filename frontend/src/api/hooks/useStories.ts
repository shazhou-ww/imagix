import type {
  Chapter,
  CreateChapterBody,
  CreatePlotBody,
  CreateStoryBody,
  Plot,
  Story,
  UpdateChapterBody,
  UpdatePlotBody,
  UpdateStoryBody,
} from "@imagix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const storyKeys = {
  all: (worldId: string) => ["stories", worldId] as const,
  detail: (worldId: string, id: string) => ["stories", worldId, id] as const,
};

export function useStories(worldId?: string) {
  return useQuery<Story[]>({
    queryKey: storyKeys.all(worldId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/stories`),
    enabled: !!worldId,
  });
}

export function useStory(worldId?: string, storyId?: string) {
  return useQuery<Story>({
    queryKey: storyKeys.detail(worldId ?? "", storyId ?? ""),
    queryFn: () => api.get(`/worlds/${worldId}/stories/${storyId}`),
    enabled: !!worldId && !!storyId,
  });
}

export function useCreateStory(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStoryBody) =>
      api.post<Story>(`/worlds/${worldId}/stories`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all(worldId) }),
  });
}

export function useUpdateStory(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      storyId,
      body,
    }: {
      storyId: string;
      body: UpdateStoryBody;
    }) => api.put<Story>(`/worlds/${worldId}/stories/${storyId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all(worldId) }),
  });
}

export function useDeleteStory(worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      api.delete(`/worlds/${worldId}/stories/${storyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all(worldId) }),
  });
}

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export const chapterKeys = {
  all: (storyId: string) => ["chapters", storyId] as const,
  detail: (storyId: string, id: string) => ["chapters", storyId, id] as const,
};

export function useChapters(storyId?: string) {
  return useQuery<Chapter[]>({
    queryKey: chapterKeys.all(storyId ?? ""),
    queryFn: () => api.get(`/stories/${storyId}/chapters`),
    enabled: !!storyId,
  });
}

export function useCreateChapter(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChapterBody) =>
      api.post<Chapter>(`/stories/${storyId}/chapters`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: chapterKeys.all(storyId) }),
  });
}

export function useUpdateChapter(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      chapterId,
      body,
    }: {
      chapterId: string;
      body: UpdateChapterBody;
    }) => api.put<Chapter>(`/stories/${storyId}/chapters/${chapterId}`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: chapterKeys.all(storyId) }),
  });
}

export function useDeleteChapter(storyId: string, worldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) =>
      api.delete(`/stories/${storyId}/chapters/${chapterId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chapterKeys.all(storyId) });
      qc.invalidateQueries({ queryKey: storyKeys.all(worldId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export const plotKeys = {
  all: (storyId: string) => ["plots", storyId] as const,
  detail: (storyId: string, id: string) => ["plots", storyId, id] as const,
};

export function usePlots(storyId?: string) {
  return useQuery<Plot[]>({
    queryKey: plotKeys.all(storyId ?? ""),
    queryFn: () => api.get(`/stories/${storyId}/chapters/_/plots`),
    enabled: !!storyId,
  });
}

export function useCreatePlot(storyId: string, chapterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlotBody) =>
      api.post<Plot>(`/stories/${storyId}/chapters/${chapterId}/plots`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: plotKeys.all(storyId) }),
  });
}

export function useUpdatePlot(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plotId, body }: { plotId: string; body: UpdatePlotBody }) =>
      api.put<Plot>(`/stories/${storyId}/plots/${plotId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: plotKeys.all(storyId) }),
  });
}

export function useDeletePlot(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plotId: string) =>
      api.delete(`/stories/${storyId}/plots/${plotId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: plotKeys.all(storyId) }),
  });
}
