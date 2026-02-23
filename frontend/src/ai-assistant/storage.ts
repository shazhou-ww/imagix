// ---------------------------------------------------------------------------
// AI Assistant – IndexedDB persistence layer (via `idb`)
// ---------------------------------------------------------------------------

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { AiConfig, ChatSession, SkillState, UiState } from "./types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface AiAssistantDB extends DBSchema {
  config: {
    key: string;
    value: AiConfig;
  };
  "chat-sessions": {
    key: string;
    value: ChatSession;
    indexes: { "by-updated": number };
  };
  "skill-state": {
    key: string;
    value: SkillState;
  };
  "ui-state": {
    key: string;
    value: UiState;
  };
}

const DB_NAME = "imagix-ai";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AiAssistantDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AiAssistantDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AiAssistantDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Config store – single record keyed by "ai-config"
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config");
        }
        // Chat sessions – keyed by session id, indexed by updatedAt
        if (!db.objectStoreNames.contains("chat-sessions")) {
          const store = db.createObjectStore("chat-sessions", {
            keyPath: "id",
          });
          store.createIndex("by-updated", "updatedAt");
        }
        // Skill state – single record keyed by "skill-state"
        if (!db.objectStoreNames.contains("skill-state")) {
          db.createObjectStore("skill-state");
        }
        // UI state – single record keyed by "ui-state"
        if (!db.objectStoreNames.contains("ui-state")) {
          db.createObjectStore("ui-state");
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CONFIG_KEY = "ai-config";

const DEFAULT_CONFIG: AiConfig = {
  endpoints: [],
  models: [],
  activeModelId: null,
};

export async function getAiConfig(): Promise<AiConfig> {
  const db = await getDB();
  return (await db.get("config", CONFIG_KEY)) ?? DEFAULT_CONFIG;
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const db = await getDB();
  await db.put("config", config, CONFIG_KEY);
}

// ---------------------------------------------------------------------------
// Chat sessions
// ---------------------------------------------------------------------------

export async function listChatSessions(): Promise<ChatSession[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("chat-sessions", "by-updated");
  // Reverse so newest first
  return all.reverse();
}

export async function getChatSession(
  id: string,
): Promise<ChatSession | undefined> {
  const db = await getDB();
  return db.get("chat-sessions", id);
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const db = await getDB();
  await db.put("chat-sessions", session);
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("chat-sessions", id);
}

// ---------------------------------------------------------------------------
// Skill state
// ---------------------------------------------------------------------------

const SKILL_KEY = "skill-state";

const DEFAULT_SKILL_STATE: SkillState = {
  loadedSkillIds: [
    "world-management",
    "character-management",
    "relationships",
    "events",
    "narrative",
    "taxonomy",
    "templates",
    "navigation",
  ],
};

export async function getSkillState(): Promise<SkillState> {
  const db = await getDB();
  return (await db.get("skill-state", SKILL_KEY)) ?? DEFAULT_SKILL_STATE;
}

export async function saveSkillState(state: SkillState): Promise<void> {
  const db = await getDB();
  await db.put("skill-state", state, SKILL_KEY);
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

const UI_KEY = "ui-state";

const DEFAULT_UI_STATE: UiState = {
  panelOpen: false,
  activeSessionId: null,
};

export async function getUiState(): Promise<UiState> {
  const db = await getDB();
  return (await db.get("ui-state", UI_KEY)) ?? DEFAULT_UI_STATE;
}

export async function saveUiState(state: UiState): Promise<void> {
  const db = await getDB();
  await db.put("ui-state", state, UI_KEY);
}
