// ---------------------------------------------------------------------------
// AI Assistant – LLM Service Worker
//
// Handles LLM API streaming and MCP tool calls in a Service Worker so that
// page refreshes do not interrupt an ongoing stream.  Communicates with the
// main thread via postMessage.
// ---------------------------------------------------------------------------

/* eslint-disable no-restricted-globals */

// Take control immediately on install / activation
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} sessionId → stream state */
const activeStreams = new Map();

/**
 * Recently completed streams – kept for a short period so that a page that
 * refreshes mid-stream can still retrieve the final result.
 * @type {Map<string, object>}
 */
const completedStreams = new Map();

let toolCallCounter = 0;
function generateToolCallId() {
  return (
    "tc_sw_" +
    Date.now().toString(36) +
    "_" +
    (++toolCallCounter).toString(36)
  );
}

function generateMsgId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Broadcast helper – send to ALL connected window clients
// ---------------------------------------------------------------------------

async function broadcast(msg) {
  const allClients = await self.clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage(msg);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener("message", (event) => {
  const { type, ...payload } = event.data;
  switch (type) {
    case "start":
      handleStart(payload);
      break;
    case "abort":
      handleAbort(payload.sessionId);
      break;
    case "nav-tool-result":
      handleNavToolResult(payload);
      break;
    case "get-state":
      handleGetState();
      break;
  }
});

// ---------------------------------------------------------------------------
// Start streaming tool loop
// ---------------------------------------------------------------------------

async function handleStart(payload) {
  const {
    sessionId,
    endpoint,
    model,
    messages,
    tools,
    systemPrompt,
    authToken,
    navToolNames,
  } = payload;

  // Abort any existing stream for this session
  if (activeStreams.has(sessionId)) {
    activeStreams.get(sessionId).abortController?.abort();
  }

  const state = {
    isStreaming: true,
    accumulatedText: "",
    activeToolCallName: null,
    newMessages: [],
    abortController: new AbortController(),
    endpoint,
    model,
    tools,
    systemPrompt,
    authToken,
    navToolNames: new Set(navToolNames || []),
    pendingNavToolResolve: null,
    pendingNavToolRequest: null,
    baseMessageCount: messages.length,
  };

  activeStreams.set(sessionId, state);

  try {
    await runToolLoop(sessionId, messages, state);
  } catch (e) {
    if (e.name !== "AbortError") {
      const errorMsg = {
        id: generateMsgId(),
        role: "assistant",
        content: "\u274c \u53d1\u751f\u9519\u8bef\uff1a" + (e.message || String(e)),
        timestamp: Date.now(),
      };
      state.newMessages.push(errorMsg);
      broadcast({ type: "error", sessionId, error: e.message || String(e) });
    }
  } finally {
    state.isStreaming = false;
    const result = {
      type: "done",
      sessionId,
      newMessages: [...state.newMessages],
      baseMessageCount: state.baseMessageCount,
    };
    broadcast(result);

    // Keep completed state for reconnection during refresh
    completedStreams.set(sessionId, {
      newMessages: [...state.newMessages],
      baseMessageCount: state.baseMessageCount,
      completedAt: Date.now(),
    });
    activeStreams.delete(sessionId);

    // Clean up after 60 seconds
    setTimeout(() => completedStreams.delete(sessionId), 60000);
  }
}

// ---------------------------------------------------------------------------
// Tool loop
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 15;

async function runToolLoop(sessionId, initialMessages, state) {
  let currentMessages = [...initialMessages];
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    state.accumulatedText = "";

    let accumulatedText = "";
    const toolCalls = [];

    // Send to LLM
    await sendToLLM({
      endpoint: state.endpoint,
      model: state.model,
      messages: currentMessages,
      tools: state.tools,
      systemPrompt: state.systemPrompt,
      signal: state.abortController.signal,
      onText: (delta) => {
        accumulatedText += delta;
        state.accumulatedText = accumulatedText;
        broadcast({
          type: "text-delta",
          sessionId,
          delta,
          accumulated: accumulatedText,
        });
      },
      onToolCall: (tc) => {
        toolCalls.push(tc);
        broadcast({ type: "tool-call", sessionId, toolCall: tc });
      },
      onError: (error) => {
        accumulatedText += "\n\n\u274c " + error;
        state.accumulatedText = accumulatedText;
        broadcast({
          type: "text-delta",
          sessionId,
          delta: "\n\n\u274c " + error,
          accumulated: accumulatedText,
        });
      },
    });

    // Fallback: parse tool calls from text (e.g. DeepSeek DSML)
    if (toolCalls.length === 0 && accumulatedText) {
      const parsed = parseTextToolCalls(accumulatedText);
      if (parsed) {
        toolCalls.push(...parsed.toolCalls);
        accumulatedText = parsed.cleanText;
        state.accumulatedText = accumulatedText;
        broadcast({
          type: "text-delta",
          sessionId,
          delta: "",
          accumulated: accumulatedText,
        });
      }
    }

    // Build assistant message
    const assistantMsg = {
      id: generateMsgId(),
      role: "assistant",
      content: accumulatedText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: Date.now(),
    };
    currentMessages.push(assistantMsg);
    state.newMessages.push(assistantMsg);

    // Broadcast: assistant message added
    broadcast({
      type: "messages-updated",
      sessionId,
      newMessages: [...state.newMessages],
    });

    // If no tool calls, we're done
    if (toolCalls.length === 0) break;

    // Execute tool calls
    for (const tc of toolCalls) {
      state.activeToolCallName = tc.name;
      broadcast({ type: "tool-executing", sessionId, toolName: tc.name });

      let result;
      if (state.navToolNames.has(tc.name)) {
        // Navigation tool → ask main thread
        result = await requestNavToolExecution(sessionId, tc, state);
      } else {
        // MCP tool
        result = await executeMcpTool(
          tc.name,
          JSON.parse(tc.arguments || "{}"),
          state.authToken,
        );
      }

      const toolMsg = {
        id: generateMsgId(),
        role: "tool",
        content: result.content,
        toolCallId: tc.id,
        toolName: tc.name,
        timestamp: Date.now(),
      };
      currentMessages.push(toolMsg);
      state.newMessages.push(toolMsg);
    }

    state.activeToolCallName = null;
    state.accumulatedText = "";

    // Broadcast: tool results added
    broadcast({
      type: "messages-updated",
      sessionId,
      newMessages: [...state.newMessages],
    });

    // Check if aborted during tool execution
    if (state.abortController.signal.aborted) {
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Navigation tool – delegate to main thread
// ---------------------------------------------------------------------------

function requestNavToolExecution(sessionId, toolCall, state) {
  return new Promise((resolve) => {
    state.pendingNavToolResolve = resolve;
    state.pendingNavToolRequest = toolCall;
    broadcast({
      type: "nav-tool-request",
      sessionId,
      toolCall,
    });

    // Timeout after 60s (allows for page refresh)
    setTimeout(() => {
      if (state.pendingNavToolResolve === resolve) {
        state.pendingNavToolResolve = null;
        state.pendingNavToolRequest = null;
        resolve({
          content: "\u5bfc\u822a\u5de5\u5177\u6267\u884c\u8d85\u65f6",
          isError: true,
        });
      }
    }, 60000);
  });
}

function handleNavToolResult({ sessionId, toolCallId, result }) {
  const state = activeStreams.get(sessionId);
  if (state?.pendingNavToolResolve) {
    state.pendingNavToolResolve(result);
    state.pendingNavToolResolve = null;
    state.pendingNavToolRequest = null;
  }
}

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

function handleAbort(sessionId) {
  const state = activeStreams.get(sessionId);
  if (state) {
    state.abortController?.abort();
  }
}

// ---------------------------------------------------------------------------
// Get state (for reconnection after page refresh)
// ---------------------------------------------------------------------------

function handleGetState() {
  // Check active streams first
  for (const [sessionId, state] of activeStreams) {
    broadcast({
      type: "state",
      sessionId,
      isStreaming: true,
      accumulated: state.accumulatedText,
      activeToolCallName: state.activeToolCallName,
      newMessages: [...state.newMessages],
      baseMessageCount: state.baseMessageCount,
      pendingNavToolRequest: state.pendingNavToolRequest
        ? { ...state.pendingNavToolRequest }
        : null,
    });
    return;
  }

  // Check recently completed streams
  for (const [sessionId, data] of completedStreams) {
    broadcast({
      type: "state",
      sessionId,
      isStreaming: false,
      accumulated: "",
      activeToolCallName: null,
      newMessages: [...data.newMessages],
      baseMessageCount: data.baseMessageCount,
      pendingNavToolRequest: null,
    });
    completedStreams.delete(sessionId); // One-time read
    return;
  }

  // No active or completed streams
  broadcast({
    type: "state",
    sessionId: null,
    isStreaming: false,
    accumulated: "",
    activeToolCallName: null,
    newMessages: [],
    baseMessageCount: 0,
    pendingNavToolRequest: null,
  });
}

// ---------------------------------------------------------------------------
// MCP Tool Execution (JSON-RPC over HTTP)
// ---------------------------------------------------------------------------

async function executeMcpTool(name, args, authToken) {
  try {
    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    };

    const res = await fetch("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer " + authToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        "MCP request failed: " + res.status + " " + res.statusText,
      );
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(
        "MCP error " + json.error.code + ": " + json.error.message,
      );
    }

    const text = json.result.content.map((c) => c.text).join("\n");
    return { content: text, isError: json.result.isError };
  } catch (e) {
    return {
      content:
        "\u5de5\u5177\u8c03\u7528\u5931\u8d25\uff1a" +
        (e.message || String(e)),
      isError: true,
    };
  }
}

// ===========================================================================
// LLM Streaming
// ===========================================================================

async function sendToLLM(opts) {
  if (opts.endpoint.provider === "anthropic") {
    return sendAnthropic(opts);
  }
  return sendOpenAI(opts);
}

// ---------------------------------------------------------------------------
// OpenAI-compatible
// ---------------------------------------------------------------------------

function toOpenAIMessages(messages, systemPrompt) {
  const out = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });
    } else if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toOpenAITools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

async function sendOpenAI({
  endpoint,
  model,
  messages,
  tools,
  systemPrompt,
  signal,
  onText,
  onToolCall,
  onError,
}) {
  const url = endpoint.url.replace(/\/$/, "") + "/v1/chat/completions";
  const body = {
    model: model.name,
    messages: toOpenAIMessages(messages, systemPrompt),
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = toOpenAITools(tools);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + endpoint.apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    onError("LLM API error " + res.status + ": " + text);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const partialToolCalls = new Map();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          for (const tc of partialToolCalls.values()) {
            onToolCall(tc);
          }
          return;
        }

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            onText(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!partialToolCalls.has(idx)) {
                partialToolCalls.set(idx, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  arguments: "",
                });
              }
              const partial = partialToolCalls.get(idx);
              if (tc.id) partial.id = tc.id;
              if (tc.function?.name) partial.name = tc.function.name;
              if (tc.function?.arguments)
                partial.arguments += tc.function.arguments;
            }
          }

          if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
            for (const tc of partialToolCalls.values()) {
              onToolCall(tc);
            }
            partialToolCalls.clear();
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Emit remaining tool calls if stream ended without [DONE]
    for (const tc of partialToolCalls.values()) {
      onToolCall(tc);
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "assistant" && m.toolCalls?.length) {
      const content = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments || "{}"),
        });
      }
      out.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      const last = out[out.length - 1];
      const toolResult = {
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
      };
      if (last?.role === "user" && Array.isArray(last.content)) {
        last.content.push(toolResult);
      } else {
        out.push({ role: "user", content: [toolResult] });
      }
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

async function sendAnthropic({
  endpoint,
  model,
  messages,
  tools,
  systemPrompt,
  signal,
  onText,
  onToolCall,
  onError,
}) {
  const url = endpoint.url.replace(/\/$/, "") + "/v1/messages";
  const body = {
    model: model.name,
    max_tokens: 8192,
    system: systemPrompt,
    messages: toAnthropicMessages(messages),
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = toAnthropicTools(tools);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": endpoint.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    onError("LLM API error " + res.status + ": " + text);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentToolUse = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case "content_block_start":
              if (event.content_block?.type === "tool_use") {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  arguments: "",
                };
              }
              break;

            case "content_block_delta":
              if (event.delta?.type === "text_delta" && event.delta.text) {
                onText(event.delta.text);
              }
              if (
                event.delta?.type === "input_json_delta" &&
                event.delta.partial_json
              ) {
                if (currentToolUse) {
                  currentToolUse.arguments += event.delta.partial_json;
                }
              }
              break;

            case "content_block_stop":
              if (currentToolUse) {
                onToolCall(currentToolUse);
                currentToolUse = null;
              }
              break;

            case "message_stop":
              return;

            case "error":
              onError(event.error?.message ?? "Unknown Anthropic error");
              return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ===========================================================================
// Text-based tool call parser (fallback for DeepSeek DSML, XML, etc.)
// ===========================================================================

const DSML_BLOCK_RE =
  /<\uff5cDSML\uff5cfunction_calls>([\s\S]*?)(?:<\uff5cDSML\uff5cfunction_calls>|$)/g;
const DSML_INVOKE_RE =
  /<\uff5cDSML\uff5cinvoke\s+name="([^"]*)">([\s\S]*?)(?:<\uff5cDSML\uff5cinvoke>|$)/g;
const DSML_PARAM_RE =
  /<\uff5cDSML\uff5cparameter\s+name="([^"]*)"\s*(?:string="(true|false)")?\s*>([\s\S]*?)<\uff5cDSML\uff5cparameter>/g;

function parseDSML(text) {
  if (!text.includes("<\uff5cDSML\uff5c")) return null;

  const toolCalls = [];
  let cleanText = text;

  for (const blockMatch of text.matchAll(DSML_BLOCK_RE)) {
    const blockContent = blockMatch[1];
    cleanText = cleanText.replace(blockMatch[0], "");

    for (const invokeMatch of blockContent.matchAll(DSML_INVOKE_RE)) {
      const toolName = invokeMatch[1];
      const paramsContent = invokeMatch[2];
      const args = {};

      for (const paramMatch of paramsContent.matchAll(DSML_PARAM_RE)) {
        const paramName = paramMatch[1];
        const isString = paramMatch[2] !== "false";
        const rawValue = paramMatch[3].trim();

        if (!isString) {
          if (rawValue === "true") args[paramName] = true;
          else if (rawValue === "false") args[paramName] = false;
          else if (rawValue === "null" || rawValue === "-")
            args[paramName] = null;
          else {
            const num = Number(rawValue);
            args[paramName] = Number.isNaN(num) ? rawValue : num;
          }
        } else {
          args[paramName] = rawValue;
        }
      }

      toolCalls.push({
        id: generateToolCallId(),
        name: toolName,
        arguments: JSON.stringify(args),
      });
    }
  }

  if (toolCalls.length === 0) return null;
  return { toolCalls, cleanText: cleanText.trim() };
}

const XML_TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

function parseXmlToolCalls(text) {
  if (!text.includes("<tool_call>")) return null;

  const toolCalls = [];
  let cleanText = text;

  for (const match of text.matchAll(XML_TOOL_CALL_RE)) {
    cleanText = cleanText.replace(match[0], "");
    try {
      const parsed = JSON.parse(match[1]);
      const name = parsed.name ?? parsed.function?.name;
      const args =
        parsed.arguments ??
        parsed.function?.arguments ??
        parsed.parameters ??
        {};
      if (name) {
        toolCalls.push({
          id: generateToolCallId(),
          name,
          arguments: typeof args === "string" ? args : JSON.stringify(args),
        });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  if (toolCalls.length === 0) return null;
  return { toolCalls, cleanText: cleanText.trim() };
}

function parseTextToolCalls(text) {
  return parseDSML(text) ?? parseXmlToolCalls(text) ?? null;
}
