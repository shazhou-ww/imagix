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
  if (!existing) throw AppError.notFound("TaxonomyNode");
  if ((existing as TaxonomyNode).system)
    throw AppError.forbidden("系统预置节点不可删除");

  // Guard: check for child nodes
  const allNodes = await repo.getTaxonomyTree(worldId, tree);
  const hasChildren = (allNodes as TaxonomyNode[]).some(
    (n) => n.parentId === nodeId,
  );
  if (hasChildren) {
    throw AppError.badRequest("该分类节点下有子节点，请先删除或移动子节点");
  }

  // Guard: check for entities referencing this node
  if (tree === "CHAR") {
    const chars = await repo.listCharacters(worldId);
    const referenced = (chars as { categoryNodeId: string; deletedAt?: string }[]).some(
      (c) => !c.deletedAt && c.categoryNodeId === nodeId,
    );
    if (referenced) {
      throw AppError.badRequest("有角色正在使用该分类节点，请先修改角色分类");
    }
  } else if (tree === "THING") {
    const things = await repo.listThings(worldId);
    const referenced = (things as { categoryNodeId: string; deletedAt?: string }[]).some(
      (t) => !t.deletedAt && t.categoryNodeId === nodeId,
    );
    if (referenced) {
      throw AppError.badRequest("有事物正在使用该分类节点，请先修改事物分类");
    }
  } else if (tree === "REL") {
    const rels = await repo.listRelationships(worldId);
    const referenced = (rels as { typeNodeId: string; deletedAt?: string }[]).some(
      (r) => !r.deletedAt && r.typeNodeId === nodeId,
    );
    if (referenced) {
      throw AppError.badRequest("有关系正在使用该类型节点，请先修改关系类型");
    }
  }

  await repo.deleteTaxonomyNode(worldId, tree, nodeId);
}
