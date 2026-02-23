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
import { fetchAuthSession } from "aws-amplify/auth";
import { mcpListTools } from "./mcp-client";
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
import {
  addSwEventListener,
  registerLlmServiceWorker,
  sendNavToolResult,
  sendToSw,
  type SwInboundEvent,
} from "./sw-bridge";
import { buildSystemPrompt, parsePageContext } from "./system-prompt";
import type {
  AiConfig,
  ChatMessage,
  ChatSession,
  ToolDefinition,
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

  // Refs for Service Worker event handler (kept in sync with latest values)
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const locationRef = useRef(location);
  locationRef.current = location;

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
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;
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

  // Track base message count for Service Worker message merging
  const baseMessageCountRef = useRef(0);

  // Cache MCP tool definitions
  const mcpToolsRef = useRef<ToolDefinition[] | null>(null);

  // ---------------------------------------------------------------------------
  // Service Worker event handler
  // ---------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: uses refs for latest values
  const handleSwEvent = useCallback((event: SwInboundEvent) => {
    switch (event.type) {
      case "text-delta": {
        if (event.sessionId !== activeSessionRef.current?.id) return;
        setStreamingText(event.accumulated);
        break;
      }
      case "tool-executing": {
        if (event.sessionId !== activeSessionRef.current?.id) return;
        setActiveToolCallName(event.toolName);
        break;
      }
      case "messages-updated": {
        const session = activeSessionRef.current;
        if (!session || event.sessionId !== session.id) return;
        const baseCount = baseMessageCountRef.current;
        const updated: ChatSession = {
          ...session,
          messages: [
            ...session.messages.slice(0, baseCount),
            ...event.newMessages,
          ],
          updatedAt: Date.now(),
        };
        setActiveSession(updated);
        activeSessionRef.current = updated;
        // Reset streaming text for next round
        setStreamingText("");
        setActiveToolCallName(null);
        // Persist intermediate state
        saveChatSession(updated);
        break;
      }
      case "nav-tool-request": {
        if (event.sessionId !== activeSessionRef.current?.id) return;
        const args = JSON.parse(event.toolCall.arguments || "{}");
        const result = executeNavigationTool(
          event.toolCall.name,
          args,
          locationRef.current.pathname,
          navigateRef.current,
        );
        sendNavToolResult(
          event.sessionId,
          event.toolCall.id,
          result || { content: "Unknown navigation tool", isError: true },
        );
        break;
      }
      case "done": {
        const session = activeSessionRef.current;
        if (!session || event.sessionId !== session.id) {
          setIsStreaming(false);
          return;
        }
        const baseCount = baseMessageCountRef.current;
        const final: ChatSession = {
          ...session,
          messages: [
            ...session.messages.slice(0, baseCount),
            ...event.newMessages,
          ],
          updatedAt: Date.now(),
        };
        setActiveSession(final);
        activeSessionRef.current = final;
        // Persist final state
        (async () => {
          await saveChatSession(final);
          const list = await listChatSessions();
          setSessions(list);
          await saveUiState({ panelOpen: true, activeSessionId: final.id });
        })();
        setIsStreaming(false);
        setStreamingText("");
        setActiveToolCallName(null);
        break;
      }
      case "error": {
        if (event.sessionId !== activeSessionRef.current?.id) return;
        // Error will be followed by "done" event — no need to reset here
        break;
      }
      case "state": {
        // Reconnection: Service Worker reports its current state
        if (event.sessionId === null) return;
        const session = activeSessionRef.current;
        if (!session || event.sessionId !== session.id) return;

        if (event.isStreaming) {
          // Active stream — reconnect UI state
          setIsStreaming(true);
          setStreamingText(event.accumulated);
          setActiveToolCallName(event.activeToolCallName);
          baseMessageCountRef.current = event.baseMessageCount;
          const updated: ChatSession = {
            ...session,
            messages: [
              ...session.messages.slice(0, event.baseMessageCount),
              ...event.newMessages,
            ],
            updatedAt: Date.now(),
          };
          setActiveSession(updated);
          activeSessionRef.current = updated;

          // Handle pending navigation tool request
          if (event.pendingNavToolRequest) {
            const tc = event.pendingNavToolRequest;
            const tcArgs = JSON.parse(tc.arguments || "{}");
            const tcResult = executeNavigationTool(
              tc.name,
              tcArgs,
              locationRef.current.pathname,
              navigateRef.current,
            );
            sendNavToolResult(
              event.sessionId,
              tc.id,
              tcResult || { content: "Unknown navigation tool", isError: true },
            );
          }
        } else if (event.newMessages.length > 0) {
          // Stream completed during page refresh — apply results
          const updated: ChatSession = {
            ...session,
            messages: [
              ...session.messages.slice(0, event.baseMessageCount),
              ...event.newMessages,
            ],
            updatedAt: Date.now(),
          };
          setActiveSession(updated);
          activeSessionRef.current = updated;
          (async () => {
            await saveChatSession(updated);
            const list = await listChatSessions();
            setSessions(list);
          })();
        }
        break;
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Init: load from IndexedDB + register Service Worker
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsub = addSwEventListener(handleSwEvent);

    (async () => {
      // Register Service Worker
      await registerLlmServiceWorker().catch((e) =>
        console.warn("[AI] Service Worker registration failed:", e),
      );

      // Load from IndexedDB
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

      let loadedSession: ChatSession | null = null;
      if (uiState.activeSessionId) {
        const s = await getChatSession(uiState.activeSessionId);
        if (s) {
          loadedSession = s;
          setActiveSession(s);
          activeSessionRef.current = s;
        }
      }
      setReady(true);

      // Check for active Service Worker stream (reconnection after refresh)
      if (loadedSession) {
        sendToSw({ type: "get-state" }).catch(() => {});
      }
    })();

    return unsub;
  }, [handleSwEvent]);

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
  // Send message (via Service Worker)
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
      activeSessionRef.current = session;
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

      // Get auth token for MCP calls in Service Worker
      let authToken = "";
      try {
        const authSession = await fetchAuthSession();
        authToken = authSession.tokens?.idToken?.toString() ?? "";
      } catch {
        // Continue without auth — MCP calls will fail but LLM calls still work
      }

      // Track base message count for message merging on reconnect
      baseMessageCountRef.current = session.messages.length;

      // Start streaming
      setIsStreaming(true);
      setStreamingText("");
      setActiveToolCallName(null);

      // Send to Service Worker for background processing
      try {
        await sendToSw({
          type: "start",
          sessionId: session.id,
          endpoint: {
            url: endpoint.url,
            apiKey: endpoint.apiKey,
            provider: endpoint.provider,
          },
          model: { name: model.name },
          messages: session.messages,
          tools,
          systemPrompt,
          authToken,
          navToolNames: [...NAVIGATION_TOOL_NAMES],
        });
      } catch (e) {
        console.error("[AI] Failed to send to Service Worker:", e);
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      config,
      activeSession,
      persistSession,
      getToolDefinitions,
      loadedSkillIds,
      location.pathname,
    ],
  );

  const abortStreaming = useCallback(() => {
    const session = activeSessionRef.current;
    if (session) {
      sendToSw({ type: "abort", sessionId: session.id }).catch(() => {});
    }
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
