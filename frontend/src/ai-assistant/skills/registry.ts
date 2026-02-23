// ---------------------------------------------------------------------------
// AI Assistant – Skill registry & built-in skill definitions
// ---------------------------------------------------------------------------

import type { Skill } from "../types";

// ---------------------------------------------------------------------------
// Built-in skills
// ---------------------------------------------------------------------------

export const SKILL_WORLD_MANAGEMENT: Skill = {
  id: "world-management",
  name: "世界管理",
  description: "创建、查看、编辑和删除故事世界，导入/导出世界数据",
  icon: "Public",
  allowedTools: [
    "list_worlds",
    "create_world",
    "get_world",
    "update_world",
    "delete_world",
    "export_world",
    "import_world",
  ],
  systemPrompt:
    "你可以帮助用户管理故事世界，包括创建新世界、查看世界详情、修改设置和导入/导出数据。",
};

export const SKILL_CHARACTER_MANAGEMENT: Skill = {
  id: "character-management",
  name: "角色管理",
  description: "创建和管理角色、事物、地点等实体，查看实体关系",
  icon: "Person",
  allowedTools: [
    "list_characters",
    "create_character",
    "get_character",
    "update_character",
    "delete_character",
    "end_character",
    "undo_end_character",
    "list_things",
    "create_thing",
    "get_thing",
    "update_thing",
    "delete_thing",
    "end_thing",
    "undo_end_thing",
    "list_places",
    "create_place",
    "get_place",
    "update_place",
    "delete_place",
    "list_entity_relationships",
    "compute_entity_state",
  ],
  systemPrompt:
    "你可以帮助用户管理角色、事物和地点等实体。你能创建新实体、编辑属性、标记实体终结（如角色死亡），以及查看实体在特定时间点的状态。",
};

export const SKILL_RELATIONSHIPS: Skill = {
  id: "relationships",
  name: "关系管理",
  description: "创建和管理实体之间的关系",
  icon: "Link",
  allowedTools: [
    "list_relationships",
    "create_relationship",
    "get_relationship",
    "delete_relationship",
    "end_relationship",
    "undo_end_relationship",
    "list_entity_relationships",
  ],
  systemPrompt:
    "你可以帮助用户管理实体之间的关系，如角色之间的友谊、敌对、从属等关系。",
};

export const SKILL_EVENTS: Skill = {
  id: "events",
  name: "事件管理",
  description: "创建和管理时间线事件、事件关联",
  icon: "Timeline",
  allowedTools: [
    "list_events",
    "create_event",
    "get_event",
    "update_event",
    "delete_event",
    "list_entity_events",
    "list_event_links",
    "create_event_link",
    "delete_event_link",
  ],
  systemPrompt:
    "你可以帮助用户管理时间线上的事件，创建新事件、编辑事件内容和时间、以及管理事件与实体之间的关联。",
};

export const SKILL_NARRATIVE: Skill = {
  id: "narrative",
  name: "叙事创作",
  description: "管理故事、章节和情节线",
  icon: "AutoStories",
  allowedTools: [
    "list_world_stories",
    "list_user_stories",
    "create_story",
    "get_story",
    "update_story",
    "delete_story",
    "list_chapters",
    "create_chapter",
    "get_chapter",
    "update_chapter",
    "delete_chapter",
    "list_plots",
    "create_plot",
    "get_plot",
    "update_plot",
    "delete_plot",
  ],
  systemPrompt:
    "你可以帮助用户进行叙事创作，包括创建和组织故事、章节和情节线。你能帮助构建故事结构、发展情节和安排章节顺序。",
};

export const SKILL_TAXONOMY: Skill = {
  id: "taxonomy",
  name: "分类体系",
  description: "管理分类节点和属性定义",
  icon: "AccountTree",
  allowedTools: [
    "get_taxonomy_tree",
    "create_taxonomy_node",
    "update_taxonomy_node",
    "delete_taxonomy_node",
    "list_attribute_definitions",
    "create_attribute_definition",
    "update_attribute_definition",
    "delete_attribute_definition",
  ],
  systemPrompt:
    "你可以帮助用户管理世界的分类体系（如角色类型、事物类型、关系类型）和属性定义（如年龄、名字等属性的模板）。",
};

export const SKILL_TEMPLATES: Skill = {
  id: "templates",
  name: "模板管理",
  description: "管理世界模板，从模板创建世界",
  icon: "ContentCopy",
  allowedTools: [
    "list_templates",
    "create_template",
    "get_template",
    "update_template",
    "delete_template",
    "save_world_as_template",
    "create_world_from_template",
  ],
  systemPrompt:
    "你可以帮助用户管理世界模板，保存现有世界为模板或从模板快速创建新世界。",
};

export const SKILL_NAVIGATION: Skill = {
  id: "navigation",
  name: "页面导航",
  description: "感知当前页面并导航到指定页面",
  icon: "Navigation",
  allowedTools: ["get_current_url", "navigate_to", "get_page_context"],
  systemPrompt:
    "你可以感知用户当前正在查看的页面，并帮助他们导航到特定页面。使用 get_current_url 了解当前位置，使用 navigate_to 跳转到指定页面。",
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All built-in skills */
export const ALL_SKILLS: Skill[] = [
  SKILL_WORLD_MANAGEMENT,
  SKILL_CHARACTER_MANAGEMENT,
  SKILL_RELATIONSHIPS,
  SKILL_EVENTS,
  SKILL_NARRATIVE,
  SKILL_TAXONOMY,
  SKILL_TEMPLATES,
  SKILL_NAVIGATION,
];

/** Get a skill by id */
export function getSkillById(id: string): Skill | undefined {
  return ALL_SKILLS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Auto-load: URL → relevant skills
// ---------------------------------------------------------------------------

/** Skills that are always loaded regardless of URL */
const ALWAYS_LOADED_SKILLS = new Set(["navigation", "world-management"]);

/**
 * Given a URL pathname, compute which skills should be auto-loaded.
 * This returns the "suggested" set; user pinning/unpinning overrides this.
 */
export function getAutoSkillIds(pathname: string): string[] {
  const auto = new Set<string>(ALWAYS_LOADED_SKILLS);

  // Outside of any world — only world management + navigation
  const worldMatch = pathname.match(/^\/worlds\/[^/]+/);
  if (!worldMatch) return [...auto];

  const rest = pathname.slice(worldMatch[0].length);

  // World dashboard — load a broad set
  if (!rest || rest === "/") {
    auto.add("character-management");
    auto.add("relationships");
    auto.add("events");
    auto.add("narrative");
    return [...auto];
  }

  // Route-specific mappings
  if (rest.startsWith("/characters")) auto.add("character-management");
  if (rest.startsWith("/things"))     auto.add("character-management");
  if (rest.startsWith("/places"))     auto.add("character-management");
  if (rest.startsWith("/relationships")) {
    auto.add("relationships");
    auto.add("character-management");
  }
  if (rest.startsWith("/events") || rest.startsWith("/event-links")) {
    auto.add("events");
  }
  if (rest.startsWith("/stories"))    auto.add("narrative");
  if (rest.startsWith("/taxonomy"))   auto.add("taxonomy");
  if (rest.startsWith("/attributes")) auto.add("taxonomy");
  if (rest.startsWith("/settings"))   auto.add("taxonomy");

  // Entity detail pages also benefit from relationships + events
  if (
    rest.match(/^\/(characters|things|places)\/[^/]+$/)
  ) {
    auto.add("relationships");
    auto.add("events");
  }

  return [...auto];
}

/**
 * Compute effective loaded skill ids from auto-detection + user overrides.
 *
 * Logic:
 *   effective = (auto ∪ pinned) \ unpinned
 */
export function computeEffectiveSkillIds(
  autoIds: string[],
  pinnedIds: string[],
  unpinnedIds: string[],
): string[] {
  const set = new Set(autoIds);
  for (const id of pinnedIds) set.add(id);
  for (const id of unpinnedIds) set.delete(id);
  return [...set];
}

/** Given a set of loaded skill ids, compute the union of allowed MCP tool names */
export function getActiveToolNames(loadedSkillIds: string[]): Set<string> {
  const names = new Set<string>();
  for (const id of loadedSkillIds) {
    const skill = getSkillById(id);
    if (skill) {
      for (const tool of skill.allowedTools) {
        names.add(tool);
      }
    }
  }
  return names;
}

/** Get the combined system prompt fragments from loaded skills */
export function getSkillSystemPrompts(loadedSkillIds: string[]): string {
  return loadedSkillIds
    .map((id) => getSkillById(id)?.systemPrompt)
    .filter(Boolean)
    .join("\n");
}
