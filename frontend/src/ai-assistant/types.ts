// ---------------------------------------------------------------------------
// AI Assistant – core type definitions
// ---------------------------------------------------------------------------

/** LLM provider type */
export type LlmProvider = "openai" | "anthropic";

/** A configured LLM API endpoint */
export interface AiEndpoint {
  id: string;
  /** Display name for the endpoint */
  label: string;
  /** API base URL (e.g. "https://api.openai.com") */
  url: string;
  /** API key (stored locally, never sent to our backend) */
  apiKey: string;
  /** API format to use */
  provider: LlmProvider;
}

/** A model available under an endpoint */
export interface AiModel {
  id: string;
  /** Which endpoint this model uses */
  endpointId: string;
  /** Model name for API calls (e.g. "gpt-4o") */
  name: string;
  /** Display alias in UI (e.g. "GPT-4o") */
  alias: string;
}

/** Root AI configuration */
export interface AiConfig {
  endpoints: AiEndpoint[];
  models: AiModel[];
  /** Currently selected model id */
  activeModelId: string | null;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant" | "system" | "tool";

/** A tool call issued by the LLM */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

/** A single chat message */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Tool calls requested by the assistant */
  toolCalls?: ToolCall[];
  /** For role=tool: which tool call this result belongs to */
  toolCallId?: string;
  /** For role=tool: the tool name */
  toolName?: string;
  timestamp: number;
}

/** A chat session (conversation thread) */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** A skill that groups related MCP tools */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** MCP tool names this skill requires */
  allowedTools: string[];
  /** Extra system prompt fragment appended when skill is loaded */
  systemPrompt?: string;
  /** Icon name (MUI icon) for display */
  icon?: string;
}

/** Persisted skill loading state */
export interface SkillState {
  /** Skills explicitly pinned on by the user (always loaded regardless of URL) */
  pinnedSkillIds: string[];
  /** Skills explicitly unpinned by the user (never auto-loaded) */
  unpinnedSkillIds: string[];
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export interface UiState {
  panelOpen: boolean;
  /** Active chat session id */
  activeSessionId: string | null;
}

// ---------------------------------------------------------------------------
// Tool definition (unified format for both MCP and frontend tools)
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Result from executing a tool */
export interface ToolResult {
  content: string;
  isError?: boolean;
}
