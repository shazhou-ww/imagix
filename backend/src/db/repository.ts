import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  World,
  TaxonomyNode,
  TaxonomyTree,
  AttributeDefinition,
  Character,
  Thing,
  Relationship,
  Event,
  EventLink,
  Story,
  Chapter,
  Plot,
} from "@imagix/shared";
import { docClient, TABLE_NAME } from "./client.js";
import {
  worldPk,
  worldSk,
  taxonomySk,
  attributeDefinitionSk,
  characterSk,
  thingSk,
  relationshipSk,
  eventSk,
  eventIndexSk,
  eventLinkSk,
  storySk,
  storyPk,
  chapterSk,
  plotSk,
  entityPk,
  relFromSk,
  relToSk,
  userGsi1pk,
  PREFIX,
} from "./keys.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function put(item: Record<string, unknown>) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

async function get(pk: string, sk: string) {
  const res = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }),
  );
  return res.Item ?? null;
}

async function del(pk: string, sk: string) {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk } }),
  );
}

async function queryByPkPrefix(
  pk: string,
  skPrefix: string,
  opts?: { limit?: number; skLte?: string },
) {
  let skCondition = "begins_with(sk, :prefix)";
  const exprValues: Record<string, unknown> = {
    ":pk": pk,
    ":prefix": skPrefix,
  };

  if (opts?.skLte) {
    skCondition = "sk >= :prefix AND sk <= :skLte";
    exprValues[":skLte"] = opts.skLte;
  }

  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: `pk = :pk AND ${skCondition}`,
      ExpressionAttributeValues: exprValues,
      ...(opts?.limit && { Limit: opts.limit }),
    }),
  );
  return res.Items ?? [];
}

async function queryGsi1(gsi1pk: string, skPrefix: string) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "gsi1",
      KeyConditionExpression:
        "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
      ExpressionAttributeValues: { ":pk": gsi1pk, ":prefix": skPrefix },
    }),
  );
  return res.Items ?? [];
}

/**
 * Generic partial update via UpdateCommand.
 * Builds SET expression from the provided fields.
 */
async function updateFields(
  pk: string,
  sk: string,
  fields: Record<string, unknown>,
) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const parts: string[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined) continue;
    const alias = `#${key}`;
    const placeholder = `:${key}`;
    names[alias] = key;
    values[placeholder] = val;
    parts.push(`${alias} = ${placeholder}`);
  }

  if (parts.length === 0) return;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
      UpdateExpression: `SET ${parts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export async function putWorld(world: World) {
  const pk = worldPk(world.id);
  await put({
    pk,
    sk: worldSk(),
    gsi1pk: userGsi1pk(world.userId),
    gsi1sk: `${PREFIX.WORLD}${world.id}`,
    ...world,
  });
}

export async function getWorld(worldId: string) {
  return get(worldPk(worldId), worldSk());
}

export async function listWorldsByUser(userId: string) {
  return queryGsi1(userGsi1pk(userId), PREFIX.WORLD);
}

export async function updateWorld(
  worldId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), worldSk(), fields);
}

export async function deleteWorld(worldId: string) {
  await del(worldPk(worldId), worldSk());
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export async function putTaxonomyNode(node: TaxonomyNode) {
  await put({
    pk: worldPk(node.worldId),
    sk: taxonomySk(node.tree, node.id),
    ...node,
  });
}

export async function getTaxonomyNode(
  worldId: string,
  tree: TaxonomyTree,
  nodeId: string,
) {
  return get(worldPk(worldId), taxonomySk(tree, nodeId));
}

export async function getTaxonomyTree(worldId: string, tree: TaxonomyTree) {
  const prefix =
    tree === "CHAR"
      ? PREFIX.TAXON_CHAR
      : tree === "THING"
        ? PREFIX.TAXON_THING
        : PREFIX.TAXON_REL;
  return queryByPkPrefix(worldPk(worldId), prefix);
}

export async function updateTaxonomyNode(
  worldId: string,
  tree: TaxonomyTree,
  nodeId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), taxonomySk(tree, nodeId), fields);
}

export async function deleteTaxonomyNode(
  worldId: string,
  tree: TaxonomyTree,
  nodeId: string,
) {
  await del(worldPk(worldId), taxonomySk(tree, nodeId));
}

// ---------------------------------------------------------------------------
// AttributeDefinition
// ---------------------------------------------------------------------------

export async function putAttributeDefinition(attr: AttributeDefinition) {
  await put({
    pk: worldPk(attr.worldId),
    sk: attributeDefinitionSk(attr.id),
    ...attr,
  });
}

export async function getAttributeDefinition(worldId: string, adfId: string) {
  return get(worldPk(worldId), attributeDefinitionSk(adfId));
}

export async function listAttributeDefinitions(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.ATTRDEF);
}

export async function updateAttributeDefinition(
  worldId: string,
  adfId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), attributeDefinitionSk(adfId), fields);
}

export async function deleteAttributeDefinition(worldId: string, adfId: string) {
  await del(worldPk(worldId), attributeDefinitionSk(adfId));
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

export async function putCharacter(char: Character) {
  await put({
    pk: worldPk(char.worldId),
    sk: characterSk(char.id),
    ...char,
  });
}

export async function getCharacter(worldId: string, charId: string) {
  return get(worldPk(worldId), characterSk(charId));
}

export async function listCharacters(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.CHAR);
}

export async function updateCharacter(
  worldId: string,
  charId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), characterSk(charId), fields);
}

export async function deleteCharacter(worldId: string, charId: string) {
  await del(worldPk(worldId), characterSk(charId));
}

// ---------------------------------------------------------------------------
// Thing
// ---------------------------------------------------------------------------

export async function putThing(thing: Thing) {
  await put({
    pk: worldPk(thing.worldId),
    sk: thingSk(thing.id),
    ...thing,
  });
}

export async function getThing(worldId: string, thingId: string) {
  return get(worldPk(worldId), thingSk(thingId));
}

export async function listThings(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.THING);
}

export async function updateThing(
  worldId: string,
  thingId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), thingSk(thingId), fields);
}

export async function deleteThing(worldId: string, thingId: string) {
  await del(worldPk(worldId), thingSk(thingId));
}

// ---------------------------------------------------------------------------
// Relationship (with denormalized from/to index items)
// ---------------------------------------------------------------------------

export async function putRelationship(rel: Relationship) {
  const pk = worldPk(rel.worldId);

  const items = [
    { PutRequest: { Item: { pk, sk: relationshipSk(rel.id), ...rel } } },
    {
      PutRequest: {
        Item: {
          pk: entityPk(rel.fromId),
          sk: relFromSk(rel.id),
          worldId: rel.worldId,
          relId: rel.id,
        },
      },
    },
    {
      PutRequest: {
        Item: {
          pk: entityPk(rel.toId),
          sk: relToSk(rel.id),
          worldId: rel.worldId,
          relId: rel.id,
        },
      },
    },
  ];

  await docClient.send(
    new BatchWriteCommand({
      RequestItems: { [TABLE_NAME]: items },
    }),
  );
}

export async function getRelationship(worldId: string, relId: string) {
  return get(worldPk(worldId), relationshipSk(relId));
}

export async function listRelationships(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.REL);
}

export async function listRelationshipsByEntity(entityId: string) {
  return queryByPkPrefix(entityPk(entityId), PREFIX.REL_ALL);
}

export async function deleteRelationship(rel: Relationship) {
  const items = [
    {
      DeleteRequest: {
        Key: { pk: worldPk(rel.worldId), sk: relationshipSk(rel.id) },
      },
    },
    {
      DeleteRequest: {
        Key: { pk: entityPk(rel.fromId), sk: relFromSk(rel.id) },
      },
    },
    {
      DeleteRequest: {
        Key: { pk: entityPk(rel.toId), sk: relToSk(rel.id) },
      },
    },
  ];

  await docClient.send(
    new BatchWriteCommand({
      RequestItems: { [TABLE_NAME]: items },
    }),
  );
}

// ---------------------------------------------------------------------------
// Event (with denormalized participant index + EVT_IDX for ID lookup)
// ---------------------------------------------------------------------------

export async function putEvent(evt: Event) {
  const pk = worldPk(evt.worldId);
  const sk = eventSk(evt.time, evt.id);

  const items = [
    { PutRequest: { Item: { pk, sk, ...evt } } },
    {
      PutRequest: {
        Item: {
          pk,
          sk: eventIndexSk(evt.id),
          time: evt.time,
          eventId: evt.id,
        },
      },
    },
    ...evt.participantIds.map((pid) => ({
      PutRequest: {
        Item: {
          pk: entityPk(pid),
          sk: eventSk(evt.time, evt.id),
          worldId: evt.worldId,
          eventId: evt.id,
        },
      },
    })),
  ];

  for (let i = 0; i < items.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: items.slice(i, i + 25) },
      }),
    );
  }
}

/** Look up event by ID without knowing the time. */
export async function getEventById(worldId: string, eventId: string) {
  const idx = await get(worldPk(worldId), eventIndexSk(eventId));
  if (!idx) return null;
  return get(worldPk(worldId), eventSk(idx.time as number, eventId));
}

export async function getEvent(worldId: string, time: number, eventId: string) {
  return get(worldPk(worldId), eventSk(time, eventId));
}

export async function listEvents(
  worldId: string,
  opts?: { timeFrom?: number; timeTo?: number },
) {
  const pk = worldPk(worldId);
  if (opts?.timeFrom != null && opts?.timeTo != null) {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":from": eventSk(opts.timeFrom, ""),
          ":to": eventSk(opts.timeTo, "\uffff"),
        },
      }),
    );
    return res.Items ?? [];
  }
  return queryByPkPrefix(pk, PREFIX.EVT);
}

export async function listEventsByEntity(
  entityId: string,
  opts?: { timeLte?: number },
) {
  if (opts?.timeLte != null) {
    return queryByPkPrefix(entityPk(entityId), PREFIX.EVT, {
      skLte: eventSk(opts.timeLte, "\uffff"),
    });
  }
  return queryByPkPrefix(entityPk(entityId), PREFIX.EVT);
}

export async function deleteEvent(evt: Event) {
  const pk = worldPk(evt.worldId);
  const sk = eventSk(evt.time, evt.id);

  const items = [
    { DeleteRequest: { Key: { pk, sk } } },
    { DeleteRequest: { Key: { pk, sk: eventIndexSk(evt.id) } } },
    ...evt.participantIds.map((pid) => ({
      DeleteRequest: {
        Key: { pk: entityPk(pid), sk: eventSk(evt.time, evt.id) },
      },
    })),
  ];

  for (let i = 0; i < items.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: items.slice(i, i + 25) },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// EventLink
// ---------------------------------------------------------------------------

export async function putEventLink(link: EventLink) {
  await put({
    pk: worldPk(link.worldId),
    sk: eventLinkSk(link.eventIdA, link.eventIdB),
    ...link,
  });
}

export async function listEventLinks(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.EVTLINK);
}

export async function deleteEventLink(
  worldId: string,
  eventIdA: string,
  eventIdB: string,
) {
  await del(worldPk(worldId), eventLinkSk(eventIdA, eventIdB));
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export async function putStory(story: Story) {
  await put({
    pk: worldPk(story.worldId),
    sk: storySk(story.id),
    gsi1pk: userGsi1pk(story.userId),
    gsi1sk: `${PREFIX.STORY}${story.id}`,
    ...story,
  });
}

export async function getStory(worldId: string, storyId: string) {
  return get(worldPk(worldId), storySk(storyId));
}

export async function listStoriesByWorld(worldId: string) {
  return queryByPkPrefix(worldPk(worldId), PREFIX.STORY);
}

export async function listStoriesByUser(userId: string) {
  return queryGsi1(userGsi1pk(userId), PREFIX.STORY);
}

export async function updateStory(
  worldId: string,
  storyId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(worldPk(worldId), storySk(storyId), fields);
}

export async function deleteStory(worldId: string, storyId: string) {
  await del(worldPk(worldId), storySk(storyId));
}

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export async function putChapter(chapter: Chapter) {
  await put({
    pk: storyPk(chapter.storyId),
    sk: chapterSk(chapter.id),
    ...chapter,
  });
}

export async function getChapter(storyId: string, chapterId: string) {
  return get(storyPk(storyId), chapterSk(chapterId));
}

export async function listChapters(storyId: string) {
  return queryByPkPrefix(storyPk(storyId), PREFIX.CHAP);
}

export async function updateChapter(
  storyId: string,
  chapterId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(storyPk(storyId), chapterSk(chapterId), fields);
}

export async function deleteChapter(storyId: string, chapterId: string) {
  await del(storyPk(storyId), chapterSk(chapterId));
}

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export async function putPlot(plot: Plot) {
  await put({
    pk: storyPk(plot.storyId),
    sk: plotSk(plot.id),
    ...plot,
  });
}

export async function getPlot(storyId: string, plotId: string) {
  return get(storyPk(storyId), plotSk(plotId));
}

export async function listPlots(storyId: string) {
  return queryByPkPrefix(storyPk(storyId), PREFIX.PLOT);
}

export async function updatePlot(
  storyId: string,
  plotId: string,
  fields: Record<string, unknown>,
) {
  await updateFields(storyPk(storyId), plotSk(plotId), fields);
}

export async function deletePlot(storyId: string, plotId: string) {
  await del(storyPk(storyId), plotSk(plotId));
}
