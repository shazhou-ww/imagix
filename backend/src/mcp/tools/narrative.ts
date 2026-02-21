import * as chapterCtrl from "../../controllers/chapters.js";
import * as plotCtrl from "../../controllers/plots.js";
import * as storyCtrl from "../../controllers/stories.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

const wid = { type: "string", description: "World ID" } as const;

export function registerNarrativeTools(registry: ToolRegistry) {
  // ── Stories ─────────────────────────────────────────────────────────────

  registry.register({
    name: "list_world_stories",
    description:
      "List all stories in a world. Stories organize narrative arcs with chapters and plots.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid },
      required: ["worldId"],
    },
    handler: async (a) =>
      jsonResult(await storyCtrl.listByWorld(a.worldId as string)),
  });

  registry.register({
    name: "list_user_stories",
    description: "List all stories owned by the current user across all worlds.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_a, ctx) =>
      jsonResult(await storyCtrl.listByUser(ctx.userId)),
  });

  registry.register({
    name: "create_story",
    description: "Create a new story in a world. The current user becomes the owner.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        title: { type: "string", description: "Story title" },
        synopsis: { type: "string", description: "Story synopsis" },
      },
      required: ["worldId", "title"],
    },
    handler: async (a, ctx) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, ...body } = a as any;
      return jsonResult(await storyCtrl.create(worldId, ctx.userId, body));
    },
  });

  registry.register({
    name: "get_story",
    description: "Get a story by ID.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        storyId: { type: "string", description: "Story ID ('sty...')" },
      },
      required: ["worldId", "storyId"],
    },
    handler: async (a) =>
      jsonResult(
        await storyCtrl.getById(a.worldId as string, a.storyId as string),
      ),
  });

  registry.register({
    name: "update_story",
    description: "Update a story's metadata (title, synopsis).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        storyId: { type: "string" },
        title: { type: "string" },
        synopsis: { type: "string" },
      },
      required: ["worldId", "storyId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, storyId, ...body } = a as any;
      return jsonResult(await storyCtrl.update(worldId, storyId, body));
    },
  });

  registry.register({
    name: "delete_story",
    description: "Delete a story.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, storyId: { type: "string" } },
      required: ["worldId", "storyId"],
    },
    handler: async (a) => {
      await storyCtrl.remove(a.worldId as string, a.storyId as string);
      return okResult("Story deleted.");
    },
  });

  // ── Chapters ────────────────────────────────────────────────────────────

  registry.register({
    name: "list_chapters",
    description:
      "List all chapters of a story, ordered by position in story.chapterIds.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string", description: "Story ID" } },
      required: ["storyId"],
    },
    handler: async (a) =>
      jsonResult(await chapterCtrl.list(a.storyId as string)),
  });

  registry.register({
    name: "create_chapter",
    description: "Create a chapter and append to the story's chapterIds.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        title: { type: "string", description: "Chapter title" },
        synopsis: { type: "string" },
      },
      required: ["storyId", "title"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { storyId, ...body } = a as any;
      return jsonResult(await chapterCtrl.create(storyId, body));
    },
  });

  registry.register({
    name: "get_chapter",
    description: "Get a chapter by ID.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        chapterId: { type: "string", description: "Chapter ID ('chp...')" },
      },
      required: ["storyId", "chapterId"],
    },
    handler: async (a) =>
      jsonResult(
        await chapterCtrl.getById(a.storyId as string, a.chapterId as string),
      ),
  });

  registry.register({
    name: "update_chapter",
    description: "Update a chapter's metadata.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        chapterId: { type: "string" },
        title: { type: "string" },
        synopsis: { type: "string" },
      },
      required: ["storyId", "chapterId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { storyId, chapterId, ...body } = a as any;
      return jsonResult(await chapterCtrl.update(storyId, chapterId, body));
    },
  });

  registry.register({
    name: "delete_chapter",
    description: "Delete a chapter and remove from story's chapterIds.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        chapterId: { type: "string" },
      },
      required: ["storyId", "chapterId"],
    },
    handler: async (a) => {
      await chapterCtrl.remove(a.storyId as string, a.chapterId as string);
      return okResult("Chapter deleted.");
    },
  });

  // ── Plots ───────────────────────────────────────────────────────────────

  registry.register({
    name: "list_plots",
    description:
      "List all plots in a story. Plots are the smallest narrative unit, tied to a chapter with event references.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string" } },
      required: ["storyId"],
    },
    handler: async (a) => jsonResult(await plotCtrl.list(a.storyId as string)),
  });

  registry.register({
    name: "create_plot",
    description:
      "Create a plot in a chapter. eventIds reference world events. perspectiveCharacterId sets the POV character.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        chapterId: { type: "string" },
        title: { type: "string", description: "Plot title" },
        content: { type: "string", description: "Plot narrative content" },
        eventIds: {
          type: "array",
          items: { type: "string" },
          description: "Referenced event IDs",
        },
        perspectiveCharacterId: {
          type: ["string", "null"],
          description: "POV character ID",
        },
      },
      required: ["storyId", "chapterId", "title"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { storyId, chapterId, ...body } = a as any;
      return jsonResult(await plotCtrl.create(storyId, chapterId, body));
    },
  });

  registry.register({
    name: "get_plot",
    description: "Get a plot by ID.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        plotId: { type: "string", description: "Plot ID ('plt...')" },
      },
      required: ["storyId", "plotId"],
    },
    handler: async (a) =>
      jsonResult(
        await plotCtrl.getById(a.storyId as string, a.plotId as string),
      ),
  });

  registry.register({
    name: "update_plot",
    description: "Update a plot's content, eventIds, or perspective character.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        plotId: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        eventIds: { type: "array", items: { type: "string" } },
        perspectiveCharacterId: { type: ["string", "null"] },
      },
      required: ["storyId", "plotId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { storyId, plotId, ...body } = a as any;
      return jsonResult(await plotCtrl.update(storyId, plotId, body));
    },
  });

  registry.register({
    name: "delete_plot",
    description: "Delete a plot and remove from chapter's plotIds.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string" }, plotId: { type: "string" } },
      required: ["storyId", "plotId"],
    },
    handler: async (a) => {
      await plotCtrl.remove(a.storyId as string, a.plotId as string);
      return okResult("Plot deleted.");
    },
  });
}
