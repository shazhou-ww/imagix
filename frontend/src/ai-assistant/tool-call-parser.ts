// ---------------------------------------------------------------------------
// AI Assistant – Text-based tool call parser (fallback)
//
// Some models (e.g. DeepSeek) may output tool calls as text using their native
// token format (e.g. <｜DSML｜>) instead of the structured OpenAI tool_calls
// API. This module detects and extracts such tool calls from text content.
// ---------------------------------------------------------------------------

import type { ToolCall } from "./types";

export interface ParsedToolCalls {
  /** Extracted tool calls */
  toolCalls: ToolCall[];
  /** Text with tool-call markup stripped */
  cleanText: string;
}

let toolCallCounter = 0;

function generateToolCallId(): string {
  return `tc_text_${Date.now().toString(36)}_${(++toolCallCounter).toString(36)}`;
}

// ---------------------------------------------------------------------------
// DeepSeek DSML format
//
// <｜DSML｜function_calls>
// <｜DSML｜invoke name="tool_name">
// <｜DSML｜parameter name="param1" string="true">value1<｜DSML｜parameter>
// <｜DSML｜parameter name="param2" string="false">123<｜DSML｜parameter>
// <｜DSML｜invoke>
// <｜DSML｜function_calls>
//
// Note: ｜ is U+FF5C (fullwidth vertical line)
// ---------------------------------------------------------------------------

const DSML_BLOCK_RE =
  /<｜DSML｜function_calls>([\s\S]*?)(?:<｜DSML｜function_calls>|$)/g;

const DSML_INVOKE_RE =
  /<｜DSML｜invoke\s+name="([^"]*)">([\s\S]*?)(?:<｜DSML｜invoke>|$)/g;

const DSML_PARAM_RE =
  /<｜DSML｜parameter\s+name="([^"]*)"\s*(?:string="(true|false)")?\s*>([\s\S]*?)<｜DSML｜parameter>/g;

function parseDSML(text: string): ParsedToolCalls | null {
  if (!text.includes("<｜DSML｜")) return null;

  const toolCalls: ToolCall[] = [];
  let cleanText = text;

  for (const blockMatch of text.matchAll(DSML_BLOCK_RE)) {
    const blockContent = blockMatch[1];
    // Remove the entire block from clean text
    cleanText = cleanText.replace(blockMatch[0], "");

    for (const invokeMatch of blockContent.matchAll(DSML_INVOKE_RE)) {
      const toolName = invokeMatch[1];
      const paramsContent = invokeMatch[2];
      const args: Record<string, unknown> = {};

      for (const paramMatch of paramsContent.matchAll(DSML_PARAM_RE)) {
        const paramName = paramMatch[1];
        const isString = paramMatch[2] !== "false";
        const rawValue = paramMatch[3].trim();

        if (!isString) {
          // Try to parse as number/boolean/null
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

// ---------------------------------------------------------------------------
// Generic XML <tool_call> format (used by some open-source models)
//
// <tool_call>
// {"name": "tool_name", "arguments": {"param": "value"}}
// </tool_call>
// ---------------------------------------------------------------------------

const XML_TOOL_CALL_RE =
  /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

function parseXmlToolCalls(text: string): ParsedToolCalls | null {
  if (!text.includes("<tool_call>")) return null;

  const toolCalls: ToolCall[] = [];
  let cleanText = text;

  for (const match of text.matchAll(XML_TOOL_CALL_RE)) {
    cleanText = cleanText.replace(match[0], "");
    try {
      const parsed = JSON.parse(match[1]);
      const name = parsed.name ?? parsed.function?.name;
      const args = parsed.arguments ?? parsed.function?.arguments ?? parsed.parameters ?? {};
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

// ---------------------------------------------------------------------------
// Unified parser — tries each format in order
// ---------------------------------------------------------------------------

/**
 * Attempt to extract tool calls from assistant text content.
 *
 * Returns `null` if no text-based tool calls are detected (i.e. the model
 * used the structured API correctly, or simply didn't call any tools).
 */
export function parseTextToolCalls(text: string): ParsedToolCalls | null {
  return parseDSML(text) ?? parseXmlToolCalls(text) ?? null;
}
