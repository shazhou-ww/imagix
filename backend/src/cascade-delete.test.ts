import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handler } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApiEvent = {
  httpMethod: string;
  path: string;
  body: string | null;
  headers: Record<string, string>;
  isBase64Encoded: boolean;
  requestContext: Record<string, unknown>;
  resource: string;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
};

function makeEvent(
  method: string,
  path: string,
  body?: unknown,
): ApiEvent {
  return {
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.",
    },
    isBase64Encoded: false,
    requestContext: {},
    resource: "",
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const result = await handler(makeEvent(method, path, body) as any);
  return {
    status: result.statusCode,
    body: result.body ? JSON.parse(result.body) : null,
  };
}

// ---------------------------------------------------------------------------
// DynamoDB Local table setup (port 4512, in-memory)
// ---------------------------------------------------------------------------

const endpoint = "http://127.0.0.1:4512";
const ddb = new DynamoDBClient({
  endpoint,
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

async function ensureTable() {
  const tables = await ddb.send(new ListTablesCommand({}));
  if (tables.TableNames?.includes("imagix")) {
    // Delete and recreate for a clean slate
    await ddb.send(new DeleteTableCommand({ TableName: "imagix" }));
  }
  await ddb.send(
    new CreateTableCommand({
      TableName: "imagix",
      BillingMode: "PAY_PER_REQUEST",
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "pk", AttributeType: "S" },
        { AttributeName: "sk", AttributeType: "S" },
        { AttributeName: "gsi1pk", AttributeType: "S" },
        { AttributeName: "gsi1sk", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "gsi1",
          KeySchema: [
            { AttributeName: "gsi1pk", KeyType: "HASH" },
            { AttributeName: "gsi1sk", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );
}

// ---------------------------------------------------------------------------
// Shared world + taxonomy setup
// ---------------------------------------------------------------------------

let worldId: string;
let charCategoryId: string;
let thingCategoryId: string;
let relTypeId: string;

beforeAll(async () => {
  await ensureTable();

  // Create world
  const w = await api("POST", "/api/worlds", {
    name: "Test World",
    description: "A world for cascade delete tests",
    epoch: "纪元开始",
  });
  expect(w.status).toBe(201);
  worldId = w.body.id;

  // Create taxonomy nodes (one for each tree)
  const charCat = await api("POST", `/api/worlds/${worldId}/taxonomy/CHAR`, {
    name: "人类",
  });
  expect(charCat.status).toBe(201);
  charCategoryId = charCat.body.id;

  const thingCat = await api("POST", `/api/worlds/${worldId}/taxonomy/THING`, {
    name: "道具",
  });
  expect(thingCat.status).toBe(201);
  thingCategoryId = thingCat.body.id;

  const relType = await api("POST", `/api/worlds/${worldId}/taxonomy/REL`, {
    name: "血缘关系",
  });
  expect(relType.status).toBe(201);
  relTypeId = relType.body.id;
});

afterAll(async () => {
  try {
    await ddb.send(new DeleteTableCommand({ TableName: "imagix" }));
  } catch { /* ignore */ }
  ddb.destroy();
});

// ===========================================================================
// 1. Story → Chapter → Plot cascade delete
// ===========================================================================

describe("Story cascade delete", () => {
  let storyId: string;
  let chapterId: string;
  let plotId: string;
  let eventId: string;

  it("setup: create event, story, chapter, plot", async () => {
    // Create an event for the plot to reference
    const evt = await api("POST", `/api/worlds/${worldId}/events`, {
      time: 1000,
      content: "测试事件",
    });
    expect(evt.status).toBe(201);
    eventId = evt.body.id;

    // Create story
    const s = await api("POST", `/api/worlds/${worldId}/stories`, {
      title: "测试故事",
    });
    expect(s.status).toBe(201);
    storyId = s.body.id;

    // Create chapter
    const ch = await api("POST", `/api/stories/${storyId}/chapters`, {
      title: "第一章",
    });
    expect(ch.status).toBe(201);
    chapterId = ch.body.id;

    // Create plot
    const pl = await api(
      "POST",
      `/api/stories/${storyId}/chapters/${chapterId}/plots`,
      { eventId },
    );
    expect(pl.status).toBe(201);
    plotId = pl.body.id;
  });

  it("delete story cascades to chapters and plots", async () => {
    // Verify they exist before delete
    const chBefore = await api("GET", `/api/stories/${storyId}/chapters/${chapterId}`);
    expect(chBefore.status).toBe(200);
    const plBefore = await api("GET", `/api/stories/${storyId}/plots/${plotId}`);
    expect(plBefore.status).toBe(200);

    // Delete the story
    const del = await api("DELETE", `/api/worlds/${worldId}/stories/${storyId}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true });

    // Verify chapter and plot are gone
    const chAfter = await api("GET", `/api/stories/${storyId}/chapters/${chapterId}`);
    expect(chAfter.status).toBe(404);

    const plAfter = await api("GET", `/api/stories/${storyId}/plots/${plotId}`);
    expect(plAfter.status).toBe(404);
  });
});

// ===========================================================================
// 2. Chapter → Plot cascade delete
// ===========================================================================

describe("Chapter cascade delete", () => {
  let storyId: string;
  let chapter1Id: string;
  let chapter2Id: string;
  let plot1Id: string;
  let plot2Id: string;
  let plot3Id: string;
  let eventId: string;

  it("setup: create story with 2 chapters, each with plots", async () => {
    const evt = await api("POST", `/api/worlds/${worldId}/events`, {
      time: 2000,
      content: "章节测试事件",
    });
    expect(evt.status).toBe(201);
    eventId = evt.body.id;

    const s = await api("POST", `/api/worlds/${worldId}/stories`, {
      title: "章节级联测试",
    });
    expect(s.status).toBe(201);
    storyId = s.body.id;

    // Chapter 1 with 2 plots
    const ch1 = await api("POST", `/api/stories/${storyId}/chapters`, {
      title: "章节一",
    });
    expect(ch1.status).toBe(201);
    chapter1Id = ch1.body.id;

    const p1 = await api(
      "POST",
      `/api/stories/${storyId}/chapters/${chapter1Id}/plots`,
      { eventId },
    );
    expect(p1.status).toBe(201);
    plot1Id = p1.body.id;

    const p2 = await api(
      "POST",
      `/api/stories/${storyId}/chapters/${chapter1Id}/plots`,
      { eventId },
    );
    expect(p2.status).toBe(201);
    plot2Id = p2.body.id;

    // Chapter 2 with 1 plot
    const ch2 = await api("POST", `/api/stories/${storyId}/chapters`, {
      title: "章节二",
    });
    expect(ch2.status).toBe(201);
    chapter2Id = ch2.body.id;

    const p3 = await api(
      "POST",
      `/api/stories/${storyId}/chapters/${chapter2Id}/plots`,
      { eventId },
    );
    expect(p3.status).toBe(201);
    plot3Id = p3.body.id;
  });

  it("delete chapter1 cascades its plots, leaves chapter2 intact", async () => {
    const del = await api("DELETE", `/api/stories/${storyId}/chapters/${chapter1Id}`);
    expect(del.status).toBe(200);

    // Chapter 1 plots gone
    const p1 = await api("GET", `/api/stories/${storyId}/plots/${plot1Id}`);
    expect(p1.status).toBe(404);
    const p2 = await api("GET", `/api/stories/${storyId}/plots/${plot2Id}`);
    expect(p2.status).toBe(404);

    // Chapter 2 and its plot unaffected
    const ch2 = await api("GET", `/api/stories/${storyId}/chapters/${chapter2Id}`);
    expect(ch2.status).toBe(200);
    const p3 = await api("GET", `/api/stories/${storyId}/plots/${plot3Id}`);
    expect(p3.status).toBe(200);

    // Story.chapterIds no longer contains chapter1Id
    const story = await api("GET", `/api/worlds/${worldId}/stories/${storyId}`);
    expect(story.status).toBe(200);
    expect(story.body.chapterIds).not.toContain(chapter1Id);
    expect(story.body.chapterIds).toContain(chapter2Id);
  });
});

// ===========================================================================
// 3. TaxonomyNode delete guards
// ===========================================================================

describe("TaxonomyNode delete guards", () => {
  it("rejects delete when child nodes exist", async () => {
    // Create parent → child
    const parent = await api("POST", `/api/worlds/${worldId}/taxonomy/CHAR`, {
      name: "父分类",
    });
    expect(parent.status).toBe(201);

    const child = await api("POST", `/api/worlds/${worldId}/taxonomy/CHAR`, {
      name: "子分类",
      parentId: parent.body.id,
    });
    expect(child.status).toBe(201);

    // Try to delete parent → should fail
    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/${parent.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("子节点");

    // Delete child first, then parent succeeds
    const delChild = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/${child.body.id}`);
    expect(delChild.status).toBe(200);

    const delParent = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/${parent.body.id}`);
    expect(delParent.status).toBe(200);
  });

  it("rejects delete when characters reference the CHAR node", async () => {
    // Create a char category
    const cat = await api("POST", `/api/worlds/${worldId}/taxonomy/CHAR`, {
      name: "测试角色分类",
    });
    expect(cat.status).toBe(201);

    // Create a character using it
    const chr = await api("POST", `/api/worlds/${worldId}/characters`, {
      name: "张三",
      categoryNodeId: cat.body.id,
      birthTime: 100,
    });
    expect(chr.status).toBe(201);

    // Try to delete the category → should fail
    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/${cat.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("角色");
  });

  it("rejects delete when things reference the THING node", async () => {
    const cat = await api("POST", `/api/worlds/${worldId}/taxonomy/THING`, {
      name: "测试事物分类",
    });
    expect(cat.status).toBe(201);

    const thg = await api("POST", `/api/worlds/${worldId}/things`, {
      name: "轩辕剑",
      categoryNodeId: cat.body.id,
      creationTime: 100,
    });
    expect(thg.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/THING/${cat.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("事物");
  });

  it("rejects delete when relationships reference the REL node", async () => {
    const relCat = await api("POST", `/api/worlds/${worldId}/taxonomy/REL`, {
      name: "测试关系类型",
    });
    expect(relCat.status).toBe(201);

    // Need two characters for a relationship
    const chr1 = await api("POST", `/api/worlds/${worldId}/characters`, {
      name: "关系测试角色A",
      categoryNodeId: charCategoryId,
      birthTime: 0,
    });
    expect(chr1.status).toBe(201);
    const chr2 = await api("POST", `/api/worlds/${worldId}/characters`, {
      name: "关系测试角色B",
      categoryNodeId: charCategoryId,
      birthTime: 0,
    });
    expect(chr2.status).toBe(201);

    const rel = await api("POST", `/api/worlds/${worldId}/relationships`, {
      typeNodeId: relCat.body.id,
      fromId: chr1.body.id,
      toId: chr2.body.id,
      establishTime: 100,
    });
    expect(rel.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/REL/${relCat.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("关系");
  });

  it("allows delete of unreferenced node", async () => {
    const cat = await api("POST", `/api/worlds/${worldId}/taxonomy/CHAR`, {
      name: "临时分类",
    });
    expect(cat.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/${cat.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true });
  });

  it("returns 404 when deleting non-existent node", async () => {
    const del = await api("DELETE", `/api/worlds/${worldId}/taxonomy/CHAR/txn_00000000000000000000000000`);
    expect(del.status).toBe(404);
  });
});

// ===========================================================================
// 4. Place delete guard (event reference)
// ===========================================================================

describe("Place delete guard", () => {
  it("rejects delete when events reference the place", async () => {
    // Create place
    const place = await api("POST", `/api/worlds/${worldId}/places`, {
      name: "临安城",
    });
    expect(place.status).toBe(201);

    // Create an event at that place
    const evt = await api("POST", `/api/worlds/${worldId}/events`, {
      time: 5000,
      content: "在临安城发生的事",
      placeId: place.body.id,
    });
    expect(evt.status).toBe(201);

    // Try to delete the place → should fail
    const del = await api("DELETE", `/api/worlds/${worldId}/places/${place.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("事件");
  });

  it("allows delete when no events reference the place", async () => {
    const place = await api("POST", `/api/worlds/${worldId}/places`, {
      name: "无事发生之地",
    });
    expect(place.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/places/${place.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true });
  });

  it("still rejects delete when child places exist (existing guard)", async () => {
    const parent = await api("POST", `/api/worlds/${worldId}/places`, {
      name: "大宋",
    });
    expect(parent.status).toBe(201);

    const child = await api("POST", `/api/worlds/${worldId}/places`, {
      name: "临安府",
      parentId: parent.body.id,
    });
    expect(child.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/places/${parent.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("子地点");
  });
});

// ===========================================================================
// 5. Event delete guard (plot reference)
// ===========================================================================

describe("Event delete guard (plot reference)", () => {
  let storyId: string;
  let chapterId: string;

  it("setup: create story and chapter for plot", async () => {
    const s = await api("POST", `/api/worlds/${worldId}/stories`, {
      title: "事件守卫测试故事",
    });
    expect(s.status).toBe(201);
    storyId = s.body.id;

    const ch = await api("POST", `/api/stories/${storyId}/chapters`, {
      title: "第一章",
    });
    expect(ch.status).toBe(201);
    chapterId = ch.body.id;
  });

  it("rejects delete when plots reference the event", async () => {
    // Create event
    const evt = await api("POST", `/api/worlds/${worldId}/events`, {
      time: 8000,
      content: "被情节引用的事件",
    });
    expect(evt.status).toBe(201);

    // Create plot referencing it
    const pl = await api(
      "POST",
      `/api/stories/${storyId}/chapters/${chapterId}/plots`,
      { eventId: evt.body.id },
    );
    expect(pl.status).toBe(201);

    // Try to delete the event → should fail
    const del = await api("DELETE", `/api/worlds/${worldId}/events/${evt.body.id}`);
    expect(del.status).toBe(400);
    expect(del.body.error).toContain("情节");
  });

  it("allows delete when no plots reference the event", async () => {
    const evt = await api("POST", `/api/worlds/${worldId}/events`, {
      time: 9000,
      content: "自由事件",
    });
    expect(evt.status).toBe(201);

    const del = await api("DELETE", `/api/worlds/${worldId}/events/${evt.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true });
  });
});
