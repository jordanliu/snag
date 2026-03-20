import type { SelectedElementSnapshot } from "@repo/dom-bridge";

const RELEVANT_STYLE_PROPERTIES = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "color",
  "background",
  "background-color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "text-transform",
  "letter-spacing",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "box-shadow",
  "opacity",
  "overflow",
  "flex",
  "flex-direction",
  "justify-content",
  "align-items",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "z-index",
] as const;

export function createSelectedElementSnapshot(
  element: Element,
): SelectedElementSnapshot {
  return {
    selector: buildBestEffortSelector(element),
    tagName: element.tagName.toLowerCase(),
    textContent: element.textContent,
    innerHTML: element.innerHTML,
    outerHTML: element.outerHTML,
    computedStyles: collectComputedStyles(element),
    attributes: collectAttributes(element),
    url: window.location.href,
  };
}

function buildBestEffortSelector(element: Element): string {
  const directIdSelector = getUniqueIdSelector(element);
  if (directIdSelector) {
    return directIdSelector;
  }

  const segments: string[] = [];
  let current: Element | null = element;

  while (current) {
    const uniqueIdSelector = getUniqueIdSelector(current);
    if (uniqueIdSelector) {
      segments.unshift(uniqueIdSelector);
      return segments.join(" > ");
    }

    segments.unshift(getSelectorSegment(current));

    const selector = segments.join(" > ");
    if (isUniqueSelector(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  return segments.join(" > ");
}

function getUniqueIdSelector(element: Element): string | null {
  if (!element.id) {
    return null;
  }

  const selector = `#${CSS.escape(element.id)}`;
  return isUniqueSelector(selector) ? selector : null;
}

function getSelectorSegment(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const classSelector = getClassSelector(element, tagName);
  if (classSelector) {
    return classSelector;
  }

  const parent = element.parentElement;
  if (!parent) {
    return tagName;
  }

  const sameTagSiblings = Array.from(parent.children).filter((candidate) => {
    return candidate.tagName === element.tagName;
  });

  if (sameTagSiblings.length === 1) {
    return tagName;
  }

  const position = sameTagSiblings.indexOf(element) + 1;
  return `${tagName}:nth-of-type(${position})`;
}

function getClassSelector(element: Element, tagName: string): string | null {
  if (!("classList" in element) || element.classList.length === 0) {
    return null;
  }

  const classNames = Array.from(element.classList).filter(Boolean).slice(0, 3);
  for (let count = classNames.length; count >= 1; count -= 1) {
    const selector = `${tagName}${classNames
      .slice(0, count)
      .map((className) => `.${CSS.escape(className)}`)
      .join("")}`;

    if (isUniqueSelector(selector)) {
      return selector;
    }
  }

  return null;
}

function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function collectComputedStyles(element: Element): Record<string, string> {
  const computedStyles = window.getComputedStyle(element);
  const styles = Object.fromEntries(
    RELEVANT_STYLE_PROPERTIES.map((propertyName) => {
      return [propertyName, computedStyles.getPropertyValue(propertyName)];
    }).filter((entry) => entry[1] !== ""),
  );

  return styles;
}

function collectAttributes(element: Element): Record<string, string> {
  return Object.fromEntries(
    Array.from(element.attributes).map((attribute) => {
      return [attribute.name, attribute.value];
    }),
  );
}
