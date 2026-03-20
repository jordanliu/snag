import {
  type BridgeCommand,
  type CommandResultMessage,
} from "@repo/dom-bridge";
import { createSelectedElementSnapshot } from "../selected-element";

type BridgeCommandExecution = {
  result: CommandResultMessage;
  targetElement: Element | null;
};

export function executeBridgeCommand(
  command: BridgeCommand,
): BridgeCommandExecution {
  const targetElement = document.querySelector(command.selector);
  if (!targetElement) {
    return {
      targetElement: null,
      result: {
        type: "command_result",
        id: command.id,
        ok: false,
        selector: command.selector,
        message: "The selected element no longer exists on the page.",
      },
    };
  }

  if (command.type === "modify_styles" && !supportsInlineStyles(targetElement)) {
    return {
      targetElement,
      result: {
        type: "command_result",
        id: command.id,
        ok: false,
        selector: command.selector,
        message: "The selected element does not support inline style updates.",
      },
    };
  }

  switch (command.type) {
    case "modify_styles": {
      const styledTarget = targetElement as Element & ElementCSSInlineStyle;
      applyStyleChanges(styledTarget, command.styles);
      break;
    }

    case "modify_content":
      if (command.html !== undefined) {
        targetElement.innerHTML = command.html;
      } else if (command.textContent !== undefined) {
        targetElement.textContent = command.textContent;
      }
      break;

    case "modify_attributes":
      applyAttributeChanges(targetElement, command.attributes);
      break;
  }

  return {
    targetElement,
    result: {
      type: "command_result",
      id: command.id,
      ok: true,
      selector: command.selector,
      message: `Applied ${command.type.replaceAll("_", " ")}.`,
      snapshot: createSelectedElementSnapshot(targetElement),
    },
  };
}

function applyStyleChanges(
  element: Element & ElementCSSInlineStyle,
  styles: Record<string, string | null>,
) {
  for (const [propertyName, value] of Object.entries(styles)) {
    if (value === null) {
      element.style.removeProperty(propertyName);
      continue;
    }

    element.style.setProperty(propertyName, value);
  }
}

function applyAttributeChanges(
  element: Element,
  attributes: Record<string, string | null>,
) {
  for (const [attributeName, value] of Object.entries(attributes)) {
    if (value === null) {
      element.removeAttribute(attributeName);
      continue;
    }

    element.setAttribute(attributeName, value);
  }
}

function supportsInlineStyles(
  element: Element,
): element is Element & ElementCSSInlineStyle {
  return "style" in element;
}
