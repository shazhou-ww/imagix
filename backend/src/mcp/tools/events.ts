import type { Event } from "@imagix/shared";
import * as eventLinkCtrl from "../../controllers/event-links.js";
import * as eventCtrl from "../../controllers/events.js";
import * as repo from "../../db/repository.js";
import { jsonResult, okResult, type ToolRegistry } from "../registry.js";

const wid = { type: "string", description: "World ID" } as const;

export function registerEventTools(registry: ToolRegistry) {
  // ── Events ──────────────────────────────────────────────────────────────

  registry.register({
    name: "list_events",
    description:
      "List events in a world, optionally filtered by time range. Events record things that happen at a point in time with attribute changes (impacts).",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        timeFrom: {
          type: "number",
          description: "Start time filter (epoch ms, inclusive)",
        },
        timeTo: {
          type: "number",
          description: "End time filter (epoch ms, inclusive)",
        },
      },
      required: ["worldId"],
    },
    handler: async (a) => {
      const opts: { timeFrom?: number; timeTo?: number } = {};
      if (a.timeFrom != null) opts.timeFrom = a.timeFrom as number;
      if (a.timeTo != null) opts.timeTo = a.timeTo as number;
      return jsonResult(await eventCtrl.list(a.worldId as string, opts));
    },
  });

  registry.register({
    name: "create_event",
    description:
      "Create an event in a world. Events modify entity state via impacts (attributeChanges, relationshipAttributeChanges). " +
      "System attributes ($age, $name, $alive) cannot be set in normal events. " +
      "Example impacts: { attributeChanges: [{ entityId: 'chr...', attribute: 'mood', value: 'happy' }], relationshipAttributeChanges: [] }",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        time: { type: "number", description: "Event time in epoch ms" },
        duration: { type: "number", description: "Duration in ms (default 0)" },
        placeId: {
          type: ["string", "null"],
          description: "Place ID where event occurred",
        },
        content: { type: "string", description: "Event description" },
        impacts: {
          type: "object",
          description: "State changes caused by this event",
          properties: {
            attributeChanges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityId: { type: "string" },
                  attribute: { type: "string" },
                  value: {},
                },
                required: ["entityId", "attribute", "value"],
              },
            },
            relationshipAttributeChanges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  relationshipId: { type: "string" },
                  attribute: { type: "string" },
                  value: {},
                },
                required: ["relationshipId", "attribute", "value"],
              },
            },
          },
        },
      },
      required: ["worldId", "time", "content"],
    },
    handler: async (a) =>
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      jsonResult(await eventCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "get_event",
    description: "Get an event by ID.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        eventId: { type: "string", description: "Event ID ('evt...')" },
      },
      required: ["worldId", "eventId"],
    },
    handler: async (a) =>
      jsonResult(
        await eventCtrl.getById(a.worldId as string, a.eventId as string),
      ),
  });

  registry.register({
    name: "update_event",
    description:
      "Update an event. System events have restrictions: epoch events allow only content changes; " +
      "birth/death events allow only time and content changes.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        eventId: { type: "string" },
        time: { type: "number" },
        duration: { type: "number" },
        placeId: { type: ["string", "null"] },
        content: { type: "string" },
        impacts: {
          type: "object",
          properties: {
            attributeChanges: { type: "array", items: { type: "object" } },
            relationshipAttributeChanges: {
              type: "array",
              items: { type: "object" },
            },
          },
        },
      },
      required: ["worldId", "eventId"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      const { worldId, eventId, ...body } = a as any;
      return jsonResult(await eventCtrl.update(worldId, eventId, body));
    },
  });

  registry.register({
    name: "delete_event",
    description:
      "Delete an event. System birth/epoch events cannot be deleted. End events can be deleted (which also clears the entity's endEventId).",
    inputSchema: {
      type: "object",
      properties: { worldId: wid, eventId: { type: "string" } },
      required: ["worldId", "eventId"],
    },
    handler: async (a) => {
      await eventCtrl.remove(a.worldId as string, a.eventId as string);
      return okResult("Event deleted.");
    },
  });

  // ── Entity Events ───────────────────────────────────────────────────────

  registry.register({
    name: "list_entity_events",
    description:
      "List all events affecting a specific entity (through impacts). Sorted by time ascending.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        entityId: { type: "string", description: "Entity ID (chr/thg/rel)" },
        timeFrom: {
          type: "number",
          description: "Start time filter (epoch ms)",
        },
        timeTo: { type: "number", description: "End time filter (epoch ms)" },
      },
      required: ["worldId", "entityId"],
    },
    handler: async (a) => {
      const worldId = a.worldId as string;
      const entityId = a.entityId as string;
      const opts: { timeLte?: number } = {};
      if (a.timeTo != null) opts.timeLte = a.timeTo as number;

      const refs = await repo.listEventsByEntity(
        entityId,
        Object.keys(opts).length > 0 ? opts : undefined,
      );
      const events = await Promise.all(
        refs.map((ref) => {
          const r = ref as { worldId: string; eventId: string };
          return repo.getEventById(r.worldId || worldId, r.eventId);
        }),
      );
      let result = events.filter(
        (e): e is Record<string, unknown> => e != null,
      ) as unknown as Event[];
      if (a.timeFrom != null) {
        const from = a.timeFrom as number;
        result = result.filter((e) => e.time >= from);
      }
      result.sort((a, b) => a.time - b.time);
      return jsonResult(result);
    },
  });

  // ── Event Links ─────────────────────────────────────────────────────────

  registry.register({
    name: "list_event_links",
    description: "List all causal/thematic links between events in a world.",
    inputSchema: {
      type: "object",
      properties: { worldId: wid },
      required: ["worldId"],
    },
    handler: async (a) =>
      jsonResult(await eventLinkCtrl.list(a.worldId as string)),
  });

  registry.register({
    name: "create_event_link",
    description:
      "Create a link between two events (causal/thematic connection). Order does not matter — IDs are normalized.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        eventIdA: { type: "string", description: "First event ID" },
        eventIdB: { type: "string", description: "Second event ID" },
        description: { type: "string", description: "Link description" },
      },
      required: ["worldId", "eventIdA", "eventIdB"],
    },
    handler: async (a) =>
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      jsonResult(await eventLinkCtrl.create(a.worldId as string, a as any)),
  });

  registry.register({
    name: "delete_event_link",
    description: "Delete a link between two events.",
    inputSchema: {
      type: "object",
      properties: {
        worldId: wid,
        eventIdA: { type: "string", description: "First event ID" },
        eventIdB: { type: "string", description: "Second event ID" },
      },
      required: ["worldId", "eventIdA", "eventIdB"],
    },
    handler: async (a) => {
      // biome-ignore lint/suspicious/noExplicitAny: MCP tool args
      await eventLinkCtrl.remove(a.worldId as string, a as any);
      return okResult("Event link deleted.");
    },
  });
}
