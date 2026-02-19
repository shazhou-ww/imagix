import { Hono } from "hono";
import {
  CreateTaxonomyNodeBody,
  UpdateTaxonomyNodeBody,
  TaxonomyTree,
} from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/taxonomy.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  .get("/:tree", async (c) => {
    const tree = TaxonomyTree.parse(p(c, "tree"));
    const nodes = await ctrl.getTree(p(c, "worldId"), tree);
    return c.json(nodes);
  })
  .post("/:tree", async (c) => {
    const tree = TaxonomyTree.parse(p(c, "tree"));
    const body = CreateTaxonomyNodeBody.parse(await c.req.json());
    const node = await ctrl.create(p(c, "worldId"), tree, body);
    return c.json(node, 201);
  })
  .put("/:tree/:nodeId", async (c) => {
    const tree = TaxonomyTree.parse(p(c, "tree"));
    const body = UpdateTaxonomyNodeBody.parse(await c.req.json());
    const node = await ctrl.update(p(c, "worldId"), tree, p(c, "nodeId"), body);
    return c.json(node);
  })
  .delete("/:tree/:nodeId", async (c) => {
    const tree = TaxonomyTree.parse(p(c, "tree"));
    await ctrl.remove(p(c, "worldId"), tree, p(c, "nodeId"));
    return c.json({ ok: true });
  });

export default app;
