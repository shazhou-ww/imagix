import {
  createId,
  EntityPrefix,
  PlotSchema,
  type Plot,
  type Chapter,
  type CreatePlotBody,
  type UpdatePlotBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function create(
  storyId: string,
  chapterId: string,
  body: CreatePlotBody,
): Promise<Plot> {
  const chapter = (await repo.getChapter(storyId, chapterId)) as Chapter | null;
  if (!chapter) throw AppError.notFound("Chapter");

  const now = new Date().toISOString();
  const plot = PlotSchema.parse({
    id: createId(EntityPrefix.Plot),
    storyId,
    chapterId,
    ...body,
    perspectiveCharacterId: body.perspectiveCharacterId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await repo.putPlot(plot);

  await repo.updateChapter(storyId, chapterId, {
    plotIds: [...chapter.plotIds, plot.id],
    updatedAt: now,
  });

  return plot;
}

export async function list(storyId: string): Promise<Plot[]> {
  const items = await repo.listPlots(storyId);
  return items as Plot[];
}

export async function getById(
  storyId: string,
  plotId: string,
): Promise<Plot> {
  const item = await repo.getPlot(storyId, plotId);
  if (!item) throw AppError.notFound("Plot");
  return item as Plot;
}

export async function update(
  storyId: string,
  plotId: string,
  body: UpdatePlotBody,
): Promise<Plot> {
  const existing = await repo.getPlot(storyId, plotId);
  if (!existing) throw AppError.notFound("Plot");
  await repo.updatePlot(storyId, plotId, {
    ...body,
    updatedAt: new Date().toISOString(),
  });
  return (await repo.getPlot(storyId, plotId)) as Plot;
}

export async function remove(
  storyId: string,
  plotId: string,
): Promise<void> {
  const plot = (await repo.getPlot(storyId, plotId)) as Plot | null;
  if (!plot) throw AppError.notFound("Plot");

  const chapter = (await repo.getChapter(storyId, plot.chapterId)) as Chapter | null;

  await repo.deletePlot(storyId, plotId);

  if (chapter) {
    await repo.updateChapter(storyId, plot.chapterId, {
      plotIds: chapter.plotIds.filter((id) => id !== plotId),
      updatedAt: new Date().toISOString(),
    });
  }
}
