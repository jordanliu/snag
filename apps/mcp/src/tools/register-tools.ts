import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type BridgeCommand, type SelectedElementSnapshot } from "@repo/dom-bridge";
import { z, type RefinementCtx } from "zod";
import {
  formatSelectionSummary,
  type WebSocketBridge,
} from "../bridge/websocket-bridge.js";
import { createToolError, createToolResult } from "./result-helpers.js";

const stylesSchema = z.record(z.string(), z.union([z.string(), z.null()]));
const attributesSchema = z.record(z.string(), z.union([z.string(), z.null()]));

const contentSchema = z
  .object({
    html: z.string().optional(),
    textContent: z.string().optional(),
  })
  .superRefine(
    (
      value: { html?: string; textContent?: string },
      context: RefinementCtx,
    ) => {
    const definedKeys = [value.html, value.textContent].filter((item) => {
      return item !== undefined;
    });

    if (definedKeys.length === 1) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of html or textContent.",
    });
    },
  );

export function registerTools(server: McpServer, bridge: WebSocketBridge) {
  server.registerTool(
    "get_selected_element",
    {
      description:
        "Return the latest element snapshot captured by the browser extension selector.",
    },
    async () => {
      if (!bridge.isExtensionConnected()) {
        return createToolError(
          "The browser extension is not connected. Start the extension and wait for the local bridge to attach.",
        );
      }

      const selection = bridge.getSelectedElement();
      if (!selection) {
        return createToolError(
          "No element is currently selected. Enable selector mode in the extension popup and click an element first.",
        );
      }

      return createToolResult(
        `Selected ${formatSelectionSummary(selection.snapshot)} on ${selection.snapshot.url}`,
        {
          snapshot: selection.snapshot,
        },
      );
    },
  );

  server.registerTool(
    "modify_element_styles",
    {
      description:
        "Apply inline style changes to the currently selected element. Use null to remove a property.",
      inputSchema: {
        styles: stylesSchema.describe(
          "A map of CSS property names to values. Set a value to null to remove that property.",
        ),
      },
    },
    createMutationToolHandler(bridge, ({ styles }, selection) => {
      return {
        type: "modify_styles",
        id: randomUUID(),
        selector: selection.selector,
        styles,
      };
    }),
  );

  server.registerTool(
    "modify_element_content",
    {
      description:
        "Replace the selected element's text content or inner HTML. Provide exactly one field.",
      inputSchema: contentSchema,
    },
    createMutationToolHandler(
      bridge,
      (input: { html?: string; textContent?: string }, selection) => {
        return {
        type: "modify_content",
        id: randomUUID(),
        selector: selection.selector,
        ...(input.html === undefined
          ? { textContent: input.textContent }
          : { html: input.html }),
        };
      },
    ),
  );

  server.registerTool(
    "modify_element_attributes",
    {
      description:
        "Set or remove attributes on the currently selected element. Use null to remove an attribute.",
      inputSchema: {
        attributes: attributesSchema.describe(
          "A map of attribute names to values. Set a value to null to remove that attribute.",
        ),
      },
    },
    createMutationToolHandler(bridge, ({ attributes }, selection) => {
      return {
        type: "modify_attributes",
        id: randomUUID(),
        selector: selection.selector,
        attributes,
      };
    }),
  );
}

function getActiveSelection(bridge: WebSocketBridge): SelectedElementSnapshot | null {
  return bridge.getSelectedElement()?.snapshot ?? null;
}

function requireActiveSelection(bridge: WebSocketBridge): SelectedElementSnapshot {
  if (!bridge.isExtensionConnected()) {
    throw new Error(
      "The browser extension is not connected. Start the extension and wait for the local bridge to attach.",
    );
  }

  const selection = getActiveSelection(bridge);
  if (!selection) {
    throw new Error(
      "No element is currently selected. Enable selector mode in the extension popup and click an element first.",
    );
  }

  return selection;
}

async function runMutationTool(
  bridge: WebSocketBridge,
  buildCommand: (selection: SelectedElementSnapshot) => BridgeCommand,
) {
  let selection: SelectedElementSnapshot;

  try {
    selection = requireActiveSelection(bridge);
  } catch (error) {
    return createToolError(getErrorMessage(error));
  }

  const nextCommand = buildCommand(selection);

  try {
    const result = await bridge.sendCommand(nextCommand);

    if (!result.ok) {
      return createToolError(result.message, {
        result,
      });
    }

    return createToolResult(
      `${result.message} (${formatSelectionSummary(result.snapshot ?? selection)})`,
      {
        result,
      },
    );
  } catch (error) {
    return createToolError(getErrorMessage(error), {
      selector: selection.selector,
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown tool error.";
}

function createMutationToolHandler<TInput>(
  bridge: WebSocketBridge,
  buildCommand: (input: TInput, selection: SelectedElementSnapshot) => BridgeCommand,
) {
  return async (input: TInput) => {
    return await runMutationTool(bridge, (selection) => {
      return buildCommand(input, selection);
    });
  };
}
