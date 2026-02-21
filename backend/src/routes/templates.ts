import { Hono } from "hono";
import {
  CreateTemplateBody,
  UpdateTemplateBody,
  CreateWorldFromTemplateBody,
} from "@imagix/shared";
import type { AppEnv } from "../app.js";
import { auth, p } from "../app.js";
import * as ctrl from "../controllers/templates.js";

const app = new Hono<AppEnv>()
  .use("*", auth)
  /** 创建空模板 */
  .post("/", async (c) => {
    const body = CreateTemplateBody.parse(await c.req.json());
    const template = await ctrl.create(c.get("userId"), body);
    return c.json(template, 201);
  })
  /** 列出当前用户的所有模板 */
  .get("/", async (c) => {
    const templates = await ctrl.list(c.get("userId"));
    return c.json(templates);
  })
  /** 获取模板详情 */
  .get("/:templateId", async (c) => {
    const template = await ctrl.getById(p(c, "templateId"));
    return c.json(template);
  })
  /** 更新模板元数据 */
  .put("/:templateId", async (c) => {
    const body = UpdateTemplateBody.parse(await c.req.json());
    const template = await ctrl.update(
      p(c, "templateId"),
      c.get("userId"),
      body,
    );
    return c.json(template);
  })
  /** 删除模板 */
  .delete("/:templateId", async (c) => {
    await ctrl.remove(p(c, "templateId"), c.get("userId"));
    return c.json({ ok: true });
  })
  /** 从模板创建世界 */
  .post("/:templateId/create-world", async (c) => {
    const body = CreateWorldFromTemplateBody.parse(await c.req.json());
    const world = await ctrl.createWorldFromTemplate(
      c.get("userId"),
      p(c, "templateId"),
      body,
    );
    return c.json(world, 201);
  });

export default app;
