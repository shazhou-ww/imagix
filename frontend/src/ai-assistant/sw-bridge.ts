// ---------------------------------------------------------------------------
// AI Assistant – Service Worker bridge
//
// Communication layer between the main thread and the LLM Service Worker.
// Handles registration, message passing, and event subscription.
// ---------------------------------------------------------------------------

import type { ChatMessage, ToolCall, ToolResult } from "./types";

// ---------------------------------------------------------------------------
// Outbound message types (main thread → Service Worker)
// ---------------------------------------------------------------------------

export type SwOutboundMessage =
  | {
      type: "start";
      sessionId: string;
      endpoint: { url: string; apiKey: string; provider: string };
      model: { name: string };
      messages: ChatMessage[];
      tools: Array<{
        name: string;
        description: string;
        inputSchema: unknown;
      }>;
      systemPrompt: string;
      authToken: string;
      navToolNames: string[];
    }
  | { type: "abort"; sessionId: string }
  | {
      type: "nav-tool-result";
      sessionId: string;
      toolCallId: string;
      result: ToolResult;
    }
  | { type: "get-state" };

// ---------------------------------------------------------------------------
// Inbound event types (Service Worker → main thread)
// ---------------------------------------------------------------------------

export type SwInboundEvent =
  | {
      type: "text-delta";
      sessionId: string;
      delta: string;
      accumulated: string;
    }
  | { type: "tool-call"; sessionId: string; toolCall: ToolCall }
  | { type: "tool-executing"; sessionId: string; toolName: string }
  | { type: "nav-tool-request"; sessionId: string; toolCall: ToolCall }
  | {
      type: "messages-updated";
      sessionId: string;
      newMessages: ChatMessage[];
    }
  | {
      type: "done";
      sessionId: string;
      newMessages: ChatMessage[];
      baseMessageCount: number;
    }
  | { type: "error"; sessionId: string; error: string }
  | {
      type: "state";
      sessionId: string | null;
      isStreaming: boolean;
      accumulated: string;
      activeToolCallName: string | null;
      newMessages: ChatMessage[];
      baseMessageCount: number;
      pendingNavToolRequest: ToolCall | null;
    };

// ---------------------------------------------------------------------------
// Event listener type
// ---------------------------------------------------------------------------

export type SwEventHandler = (event: SwInboundEvent) => void;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let registered = false;
let readyPromise: Promise<ServiceWorkerRegistration> | null = null;
const listeners = new Set<SwEventHandler>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the LLM Service Worker. Call once on app startup.
 * Returns when the SW is active and controlling the page.
 */
export function registerLlmServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Workers not supported");
    }

    const registration = await navigator.serviceWorker.register("/llm-sw.js", {
      scope: "/",
    });

    // Set up message listener once
    if (!registered) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const data = event.data as SwInboundEvent;
        for (const handler of listeners) {
          handler(data);
        }
      });
      registered = true;
    }

    // Wait for the SW to be ready and controlling the page
    await navigator.serviceWorker.ready;

    return registration;
  })();

  return readyPromise;
}

/**
 * Send a message to the Service Worker.
 */
export async function sendToSw(msg: SwOutboundMessage): Promise<void> {
  await readyPromise;

  const sw = navigator.serviceWorker.controller;
  if (sw) {
    sw.postMessage(msg);
    return;
  }

  // SW not controlling yet — get active worker from registration
  const reg = await navigator.serviceWorker.ready;
  const active = reg.active;
  if (!active) throw new Error("Service Worker not active");
  active.postMessage(msg);
}

/**
 * Subscribe to events from the Service Worker.
 * Returns an unsubscribe function.
 */
export function addSwEventListener(handler: SwEventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

/**
 * Send a navigation tool result back to the Service Worker.
 */
export function sendNavToolResult(
  sessionId: string,
  toolCallId: string,
  result: ToolResult,
): void {
  sendToSw({ type: "nav-tool-result", sessionId, toolCallId, result });
}
