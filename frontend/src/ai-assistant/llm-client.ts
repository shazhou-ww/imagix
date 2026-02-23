// ---------------------------------------------------------------------------
// AI Assistant – LLM API client (OpenAI-compatible + Anthropic)
//
// Sends chat messages with tool definitions to the user-configured LLM,
// handles streaming responses, and normalises tool calls into a unified format.
// ---------------------------------------------------------------------------

import type {
  AiEndpoint,
  AiModel,
  ChatMessage,
  ToolCall,
  ToolDefinition,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmStreamEvent {
  type: "text" | "tool_call" | "done" | "error";
  /** Incremental text delta */
  text?: string;
  /** Complete tool call (emitted once per tool call when fully received) */
  toolCall?: ToolCall;
  /** Error message */
  error?: string;
}

export interface SendMessageOptions {
  endpoint: AiEndpoint;
  model: AiModel;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  systemPrompt: string;
  onEvent: (event: LlmStreamEvent) => void;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Unified entry point
// ---------------------------------------------------------------------------

export async function sendMessage(opts: SendMessageOptions): Promise<void> {
  if (opts.endpoint.provider === "anthropic") {
    return sendAnthropic(opts);
  }
  return sendOpenAI(opts);
}

// ---------------------------------------------------------------------------
// OpenAI-compatible
// ---------------------------------------------------------------------------

function toOpenAIMessages(
  messages: ChatMessage[],
  systemPrompt: string,
): unknown[] {
  const out: unknown[] = [{ role: "system", content: systemPrompt }];
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

function toOpenAITools(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

async function sendOpenAI(opts: SendMessageOptions): Promise<void> {
  const { endpoint, model, messages, tools, systemPrompt, onEvent, signal } =
    opts;

  const url = `${endpoint.url.replace(/\/$/, "")}/v1/chat/completions`;
  const body: Record<string, unknown> = {
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
      Authorization: `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    onEvent({ type: "error", error: `LLM API error ${res.status}: ${text}` });
    return;
  }

  // Parse SSE stream
  const reader = res.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", error: "No response body" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  // Accumulate partial tool calls: index -> { id, name, arguments }
  const partialToolCalls = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

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
          // Emit any accumulated tool calls
          for (const tc of partialToolCalls.values()) {
            console.log('[LLM] Emitting tool call at [DONE]:', tc.name);
            onEvent({ type: "tool_call", toolCall: tc });
          }
          onEvent({ type: "done" });
          return;
        }

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            onEvent({ type: "text", text: delta.content });
          }

          // Tool calls
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
              const partial = partialToolCalls.get(idx)!;
              if (tc.id) partial.id = tc.id;
              if (tc.function?.name) partial.name = tc.function.name;
              if (tc.function?.arguments)
                partial.arguments += tc.function.arguments;
            }
          }

          // Finish reason
          if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
            for (const tc of partialToolCalls.values()) {
              console.log('[LLM] Emitting tool call at finish_reason:', tc.name);
              onEvent({ type: "tool_call", toolCall: tc });
            }
            partialToolCalls.clear();
          }
          // Log other finish reasons for debugging
          const fr = chunk.choices?.[0]?.finish_reason;
          if (fr && fr !== "tool_calls") {
            console.log('[LLM] finish_reason:', fr);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Emit remaining tool calls if stream ended without [DONE]
    for (const tc of partialToolCalls.values()) {
      onEvent({ type: "tool_call", toolCall: tc });
    }
    onEvent({ type: "done" });
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
  const out: unknown[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // system is separate in Anthropic API

    if (m.role === "assistant" && m.toolCalls?.length) {
      const content: unknown[] = [];
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
      // Anthropic expects tool results as user messages with tool_result content
      // Check if previous message in out is already a user with tool_result
      const last = out[out.length - 1] as
        | { role: string; content: unknown[] }
        | undefined;
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

function toAnthropicTools(tools: ToolDefinition[]): unknown[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

async function sendAnthropic(opts: SendMessageOptions): Promise<void> {
  const { endpoint, model, messages, tools, systemPrompt, onEvent, signal } =
    opts;

  const url = `${endpoint.url.replace(/\/$/, "")}/v1/messages`;
  const body: Record<string, unknown> = {
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
    onEvent({ type: "error", error: `LLM API error ${res.status}: ${text}` });
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", error: "No response body" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  // Current tool_use being built
  let currentToolUse: { id: string; name: string; arguments: string } | null =
    null;

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
                onEvent({ type: "text", text: event.delta.text });
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
                console.log('[LLM/Anthropic] Emitting tool call:', currentToolUse.name);
                onEvent({ type: "tool_call", toolCall: currentToolUse });
                currentToolUse = null;
              }
              break;

            case "message_stop":
              onEvent({ type: "done" });
              return;

            case "error":
              onEvent({
                type: "error",
                error: event.error?.message ?? "Unknown Anthropic error",
              });
              return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    onEvent({ type: "done" });
  } finally {
    reader.releaseLock();
  }
}
