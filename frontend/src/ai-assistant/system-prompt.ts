// ---------------------------------------------------------------------------
// AI Assistant – System prompt builder
// ---------------------------------------------------------------------------

import { getSkillSystemPrompts } from "./skills/registry";

/**
 * Build the full system prompt from base description + URL context + skills.
 */
export function buildSystemPrompt(
  loadedSkillIds: string[],
  currentPath: string,
  pageContext: string,
): string {
  const parts: string[] = [];

  // Base role
  parts.push(`你是 Imagix 世界观创作助手，一个帮助用户构建虚构世界的 AI 助理。
你可以帮助用户管理故事世界中的角色、事物、地点、关系、事件、故事等元素。
请始终使用中文回复用户。

重要规则：
- 在执行任何创建、修改、删除操作前，先向用户确认意图
- 对于查询类操作可以直接执行
- 返回数据时用简洁易读的格式呈现，避免直接输出原始 JSON
- 如果操作失败，向用户解释原因并建议替代方案`);

  // URL context
  if (currentPath) {
    parts.push(`\n当前用户所在页面路径：${currentPath}`);
    if (pageContext) {
      parts.push(`页面上下文：${pageContext}`);
    }
  }

  // URL routing reference for navigation
  parts.push(`
URL 路由参考（用于 navigate_to 工具）：
- /worlds — 世界列表
- /worlds/{worldId} — 世界仪表板
- /worlds/{worldId}/settings — 世界设定
- /worlds/{worldId}/taxonomy/{rootType} — 分类体系（rootType: CHAR, THING, REL）
- /worlds/{worldId}/attributes — 属性词典
- /worlds/{worldId}/characters — 角色列表
- /worlds/{worldId}/characters/{characterId} — 角色详情
- /worlds/{worldId}/things — 事物列表
- /worlds/{worldId}/things/{thingId} — 事物详情
- /worlds/{worldId}/places — 地点列表
- /worlds/{worldId}/places/{placeId} — 地点详情
- /worlds/{worldId}/relationships — 关系列表
- /worlds/{worldId}/relationships/{relationshipId} — 关系详情
- /worlds/{worldId}/events — 事件列表
- /worlds/{worldId}/events/{eventId} — 事件详情
- /worlds/{worldId}/event-links — 事件关联列表
- /worlds/{worldId}/stories — 故事列表
- /worlds/{worldId}/stories/{storyId} — 故事详情
- /settings — 用户设置`);

  // Skill-specific prompts
  const skillPrompts = getSkillSystemPrompts(loadedSkillIds);
  if (skillPrompts) {
    parts.push(`\n已启用的能力：\n${skillPrompts}`);
  }

  return parts.join("\n");
}

/**
 * Parse the current URL to extract context information.
 */
export function parsePageContext(pathname: string): string {
  const worldMatch = pathname.match(/^\/worlds\/([^/]+)/);
  if (!worldMatch) {
    if (pathname === "/settings") return "用户设置页面";
    if (pathname === "/worlds" || pathname === "/") return "世界列表页面";
    return "";
  }

  const worldId = worldMatch[1];
  const rest = pathname.slice(worldMatch[0].length);

  if (!rest || rest === "/") return `世界仪表板 (worldId: ${worldId})`;

  const routes: [RegExp, string][] = [
    [/^\/settings$/, "世界设定页面"],
    [/^\/taxonomy\/(\w+)$/, "分类体系页面"],
    [/^\/attributes$/, "属性词典页面"],
    [/^\/attributes\/([^/]+)$/, "属性详情页面"],
    [/^\/characters$/, "角色列表页面"],
    [/^\/characters\/([^/]+)$/, "角色详情页面"],
    [/^\/things$/, "事物列表页面"],
    [/^\/things\/([^/]+)$/, "事物详情页面"],
    [/^\/places$/, "地点列表页面"],
    [/^\/places\/([^/]+)$/, "地点详情页面"],
    [/^\/relationships$/, "关系列表页面"],
    [/^\/relationships\/([^/]+)$/, "关系详情页面"],
    [/^\/events$/, "事件列表页面"],
    [/^\/events\/([^/]+)$/, "事件详情页面"],
    [/^\/event-links$/, "事件关联列表页面"],
    [/^\/stories$/, "故事列表页面"],
    [/^\/stories\/([^/]+)$/, "故事详情页面"],
  ];

  for (const [re, label] of routes) {
    const m = rest.match(re);
    if (m) {
      const entityId = m[1] ?? "";
      const ctx = entityId
        ? `${label} (worldId: ${worldId}, id: ${entityId})`
        : `${label} (worldId: ${worldId})`;
      return ctx;
    }
  }

  return `世界页面 (worldId: ${worldId})`;
}
