// ---------------------------------------------------------------------------
// AI Assistant – Chat state management (React Context)
// ---------------------------------------------------------------------------

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { type LlmStreamEvent, sendMessage } from "./llm-client";
import { mcpCallTool, mcpListTools } from "./mcp-client";
import {
  NAVIGATION_TOOL_DEFS,
  NAVIGATION_TOOL_NAMES,
  executeNavigationTool,
} from "./navigation-tools";
import { getActiveToolNames, getAutoSkillIds, computeEffectiveSkillIds } from "./skills/registry";
import {
  deleteChatSession,
  getAiConfig,
  getChatSession,
  getSkillState,
  getUiState,
  listChatSessions,
  saveAiConfig,
  saveChatSession,
  saveSkillState,
  saveUiState,
} from "./storage";
import { buildSystemPrompt, parsePageContext } from "./system-prompt";
import { parseTextToolCalls } from "./tool-call-parser";
import type {
  AiConfig,
  ChatMessage,
  ChatSession,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./types";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ChatContextValue {
  // State
  ready: boolean;
  config: AiConfig;
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  panelOpen: boolean;
  loadedSkillIds: string[];
  /** Skills auto-detected from current URL */
  autoSkillIds: string[];
  /** Skills explicitly pinned by the user */
  pinnedSkillIds: string[];
  /** Skills explicitly unpinned by the user */
  unpinnedSkillIds: string[];
  isStreaming: boolean;
  streamingText: string;
  activeToolCallName: string | null;

  // Actions
  setConfig: (config: AiConfig) => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  /** Toggle a skill: if currently loaded → unpin it; if not loaded → pin it */
  toggleSkill: (skillId: string) => Promise<void>;
  createSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  sendUserMessage: (text: string) => Promise<void>;
  abortStreaming: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helper: generate an id
// ---------------------------------------------------------------------------

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Initialisation flag
  const [ready, setReady] = useState(false);

  // Core state
  const [config, setConfigState] = useState<AiConfig>({
    endpoints: [],
    models: [],
    activeModelId: null,
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [panelOpen, setPanelOpenState] = useState(false);
  const [pinnedSkillIds, setPinnedSkillIds] = useState<string[]>([]);
  const [unpinnedSkillIds, setUnpinnedSkillIds] = useState<string[]>([]);

  // Auto-detected skills from current URL
  const autoSkillIds = getAutoSkillIds(location.pathname);
  // Effective loaded skills = (auto ∪ pinned) \ unpinned
  const loadedSkillIds = computeEffectiveSkillIds(
    autoSkillIds,
    pinnedSkillIds,
    unpinnedSkillIds,
  );

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeToolCallName, setActiveToolCallName] = useState<string | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  // Cache MCP tool definitions
  const mcpToolsRef = useRef<ToolDefinition[] | null>(null);

  // ---------------------------------------------------------------------------
  // Init: load from IndexedDB
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const [cfg, skillState, uiState, sessionList] = await Promise.all([
        getAiConfig(),
        getSkillState(),
        getUiState(),
        listChatSessions(),
      ]);
      setConfigState(cfg);
      setPinnedSkillIds(skillState.pinnedSkillIds);
      setUnpinnedSkillIds(skillState.unpinnedSkillIds);
      setPanelOpenState(uiState.panelOpen);
      setSessions(sessionList);

      if (uiState.activeSessionId) {
        const s = await getChatSession(uiState.activeSessionId);
        if (s) setActiveSession(s);
      }
      setReady(true);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Persist helpers
  // ---------------------------------------------------------------------------
  const setConfig = useCallback(async (cfg: AiConfig) => {
    setConfigState(cfg);
    await saveAiConfig(cfg);
  }, []);

  const setPanelOpen = useCallback(
    (open: boolean) => {
      setPanelOpenState(open);
      saveUiState({ panelOpen: open, activeSessionId: activeSession?.id ?? null });
    },
    [activeSession],
  );

  const toggleSkill = useCallback(async (skillId: string) => {
    const isCurrentlyLoaded = computeEffectiveSkillIds(
      getAutoSkillIds(location.pathname),
      pinnedSkillIds,
      unpinnedSkillIds,
    ).includes(skillId);

    let nextPinned = [...pinnedSkillIds];
    let nextUnpinned = [...unpinnedSkillIds];
    const isAuto = getAutoSkillIds(location.pathname).includes(skillId);

    if (isCurrentlyLoaded) {
      // User is turning it OFF
      nextPinned = nextPinned.filter((id) => id !== skillId);
      if (isAuto) {
        // It was auto-loaded, so add to unpinned to suppress it
        if (!nextUnpinned.includes(skillId)) nextUnpinned.push(skillId);
      }
    } else {
      // User is turning it ON
      nextUnpinned = nextUnpinned.filter((id) => id !== skillId);
      if (!isAuto) {
        // Not auto-loaded, so pin it explicitly
        if (!nextPinned.includes(skillId)) nextPinned.push(skillId);
      }
    }

    setPinnedSkillIds(nextPinned);
    setUnpinnedSkillIds(nextUnpinned);
    await saveSkillState({ pinnedSkillIds: nextPinned, unpinnedSkillIds: nextUnpinned });
    // Invalidate cached MCP tools so they get re-filtered
    mcpToolsRef.current = null;
  }, [location.pathname, pinnedSkillIds, unpinnedSkillIds]);

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------
  const persistSession = useCallback(
    async (session: ChatSession) => {
      await saveChatSession(session);
      // Refresh session list
      const list = await listChatSessions();
      setSessions(list);
      await saveUiState({ panelOpen: true, activeSessionId: session.id });
    },
    [],
  );

  const createSession = useCallback(async () => {
    const session: ChatSession = {
      id: generateId(),
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setActiveSession(session);
    await persistSession(session);
  }, [persistSession]);

  const switchSession = useCallback(
    async (id: string) => {
      const s = await getChatSession(id);
      if (s) {
        setActiveSession(s);
        await saveUiState({ panelOpen: true, activeSessionId: id });
      }
    },
    [],
  );

  const removeSession = useCallback(
    async (id: string) => {
      await deleteChatSession(id);
      const list = await listChatSessions();
      setSessions(list);
      if (activeSession?.id === id) {
        const next = list[0] ?? null;
        setActiveSession(next);
        await saveUiState({
          panelOpen: true,
          activeSessionId: next?.id ?? null,
        });
      }
    },
    [activeSession],
  );

  // ---------------------------------------------------------------------------
  // Get tools based on loaded skills
  // ---------------------------------------------------------------------------
  const getToolDefinitions = useCallback(async (): Promise<
    ToolDefinition[]
  > => {
    const activeNames = getActiveToolNames(loadedSkillIds);

    // Always include navigation tools if the navigation skill is loaded
    const navTools = activeNames.has("get_current_url")
      ? NAVIGATION_TOOL_DEFS
      : [];

    // Fetch MCP tools (cached)
    if (!mcpToolsRef.current) {
      try {
        const allTools = await mcpListTools();
        mcpToolsRef.current = allTools;
      } catch {
        mcpToolsRef.current = [];
      }
    }

    // Filter MCP tools by active skill names
    const mcpTools = mcpToolsRef.current.filter((t) => activeNames.has(t.name));

    return [...mcpTools, ...navTools];
  }, [loadedSkillIds]);

  // ---------------------------------------------------------------------------
  // Execute a tool call
  // ---------------------------------------------------------------------------
  const executeTool = useCallback(
    async (tc: ToolCall): Promise<ToolResult> => {
      const args = JSON.parse(tc.arguments || "{}");

      // Check if it's a navigation tool first
      if (NAVIGATION_TOOL_NAMES.has(tc.name)) {
        const result = executeNavigationTool(
          tc.name,
          args,
          location.pathname,
          navigate,
        );
        if (result) return result;
      }

      // Otherwise call MCP
      try {
        return await mcpCallTool(tc.name, args);
      } catch (e) {
        return {
          content: `工具调用失败：${e instanceof Error ? e.message : String(e)}`,
          isError: true,
        };
      }
    },
    [location.pathname, navigate],
  );

  // ---------------------------------------------------------------------------
  // Send message + tool loop
  // ---------------------------------------------------------------------------
  const sendUserMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      // Resolve model & endpoint
      const model = config.models.find((m) => m.id === config.activeModelId);
      if (!model) return;
      const endpoint = config.endpoints.find(
        (e) => e.id === model.endpointId,
      );
      if (!endpoint) return;

      // Ensure we have an active session
      let session = activeSession;
      if (!session) {
        session = {
          id: generateId(),
          title: text.slice(0, 30) || "新对话",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      // Set title from first message
      if (session.messages.length === 0) {
        session = { ...session, title: text.slice(0, 30) || "新对话" };
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      session = {
        ...session,
        messages: [...session.messages, userMsg],
        updatedAt: Date.now(),
      };
      setActiveSession(session);
      await persistSession(session);

      // Get tools
      const tools = await getToolDefinitions();
      console.log('[AI] Tools loaded:', tools.length, tools.map(t => t.name));

      // Build system prompt
      const systemPrompt = buildSystemPrompt(
        loadedSkillIds,
        location.pathname,
        parsePageContext(location.pathname),
      );

      // Start streaming
      setIsStreaming(true);
      setStreamingText("");
      setActiveToolCallName(null);

      const controller = new AbortController();
      abortRef.current = controller;

      // Tool loop: keep calling LLM until it stops issuing tool calls
      let currentMessages = [...session.messages];

      try {
        let continueLoop = true;
        const MAX_TOOL_ROUNDS = 15; // Safety limit
        let round = 0;

        while (continueLoop && round < MAX_TOOL_ROUNDS) {
          continueLoop = false;
          round++;
          console.log(`[AI] Loop round ${round}, messages:`, currentMessages.length);

          let accumulatedText = "";
          const toolCalls: ToolCall[] = [];

          await sendMessage({
            endpoint,
            model,
            messages: currentMessages,
            tools,
            systemPrompt,
            signal: controller.signal,
            onEvent: (event: LlmStreamEvent) => {
              switch (event.type) {
                case "text":
                  accumulatedText += event.text ?? "";
                  setStreamingText(accumulatedText);
                  break;
                case "tool_call":
                  if (event.toolCall) {
                    toolCalls.push(event.toolCall);
                  }
                  break;
                case "error":
                  accumulatedText += `\n\n❌ ${event.error}`;
                  setStreamingText(accumulatedText);
                  break;
              }
            },
          });

          // Fallback: parse tool calls from text for models that output
          // them as text (e.g. DeepSeek's <｜DSML｜> format)
          if (toolCalls.length === 0 && accumulatedText) {
            const parsed = parseTextToolCalls(accumulatedText);
            if (parsed) {
              console.log(`[AI] Parsed ${parsed.toolCalls.length} tool call(s) from text`, parsed.toolCalls.map(tc => tc.name));
              toolCalls.push(...parsed.toolCalls);
              accumulatedText = parsed.cleanText;
              setStreamingText(accumulatedText);
            }
          }

          // Build assistant message
          console.log(`[AI] Round ${round} done. Text length: ${accumulatedText.length}, Tool calls: ${toolCalls.length}`, toolCalls.map(tc => tc.name));
          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: accumulatedText,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            timestamp: Date.now(),
          };
          currentMessages = [...currentMessages, assistantMsg];

          // Update UI with the assistant message immediately
          session = {
            ...session,
            messages: currentMessages,
            updatedAt: Date.now(),
          };
          setActiveSession(session);

          // If there are tool calls, execute them and continue the loop
          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              setActiveToolCallName(tc.name);
              const result = await executeTool(tc);

              const toolMsg: ChatMessage = {
                id: generateId(),
                role: "tool",
                content: result.content,
                toolCallId: tc.id,
                toolName: tc.name,
                timestamp: Date.now(),
              };
              currentMessages = [...currentMessages, toolMsg];
            }

            // Update UI with tool results
            session = {
              ...session,
              messages: currentMessages,
              updatedAt: Date.now(),
            };
            setActiveSession(session);

            setActiveToolCallName(null);
            setStreamingText("");
            continueLoop = true; // Continue to let LLM process tool results
            console.log(`[AI] Tool results added, continuing loop...`);
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const errorMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: `❌ 发生错误：${e instanceof Error ? e.message : String(e)}`,
            timestamp: Date.now(),
          };
          currentMessages = [...currentMessages, errorMsg];
        }
      }

      // Persist final state
      session = {
        ...session,
        messages: currentMessages,
        updatedAt: Date.now(),
      };
      setActiveSession(session);
      await persistSession(session);

      setIsStreaming(false);
      setStreamingText("");
      setActiveToolCallName(null);
      abortRef.current = null;
    },
    [
      isStreaming,
      config,
      activeSession,
      persistSession,
      getToolDefinitions,
      loadedSkillIds,
      location.pathname,
      executeTool,
    ],
  );

  const abortStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value: ChatContextValue = {
    ready,
    config,
    sessions,
    activeSession,
    panelOpen,
    loadedSkillIds,
    autoSkillIds,
    pinnedSkillIds,
    unpinnedSkillIds,
    isStreaming,
    streamingText,
    activeToolCallName,
    setConfig,
    setPanelOpen,
    toggleSkill,
    createSession,
    switchSession,
    removeSession,
    sendUserMessage,
    abortStreaming,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
