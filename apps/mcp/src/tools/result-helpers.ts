import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function createToolResult(
  text: string,
  structuredContent?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent,
  };
}

export function createToolError(
  text: string,
  structuredContent?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent,
    isError: true,
  };
}
