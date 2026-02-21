import {
  type CreateTaxonomyNodeBody,
  createId,
  EntityPrefix,
  type TaxonomyNode,
  TaxonomyNodeSchema,
  type TaxonomyTree,
  type UpdateTaxonomyNodeBody,
} from "@imagix/shared";
import * as repo from "../db/repository.js";
import { AppError } from "./errors.js";

export async function getTree(
  worldId: string,
  tree: TaxonomyTree,
): Promise<TaxonomyNode[]> {
  const items = await repo.getTaxonomyTree(worldId, tree);
  return items as TaxonomyNode[];
}

export async function create(
  worldId: string,
  tree: TaxonomyTree,
  body: CreateTaxonomyNodeBody,
): Promise<TaxonomyNode> {
  const node = TaxonomyNodeSchema.parse({
    id: createId(EntityPrefix.TaxonomyNode),
    worldId,
    tree,
    ...body,
  });
  await repo.putTaxonomyNode(node);
  return node;
}

export async function update(
  worldId: string,
  tree: TaxonomyTree,
  nodeId: string,
  body: UpdateTaxonomyNodeBody,
): Promise<TaxonomyNode> {
  const existing = await repo.getTaxonomyNode(worldId, tree, nodeId);
  if (!existing) throw AppError.notFound("TaxonomyNode");
  if ((existing as TaxonomyNode).system)
    throw AppError.forbidden("系统预置节点不可编辑");
  await repo.updateTaxonomyNode(worldId, tree, nodeId, body);
  return (await repo.getTaxonomyNode(worldId, tree, nodeId)) as TaxonomyNode;
}

export async function remove(
  worldId: string,
  tree: TaxonomyTree,
  nodeId: string,
): Promise<void> {
  const existing = await repo.getTaxonomyNode(worldId, tree, nodeId);
  if (existing && (existing as TaxonomyNode).system)
    throw AppError.forbidden("系统预置节点不可删除");
  await repo.deleteTaxonomyNode(worldId, tree, nodeId);
}
