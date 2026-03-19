import {
  getSelectorEnabled,
  SELECTOR_ENABLED_KEY,
  setSelectorEnabled,
} from "../lib/selector-mode";

type OverlayNodes = {
  host: HTMLDivElement;
  container: HTMLDivElement;
  highlight: HTMLDivElement;
  label: HTMLDivElement;
  labelName: HTMLParagraphElement;
  labelMeta: HTMLParagraphElement;
};

type StorageChangeMap = Record<
  string,
  {
    oldValue?: unknown;
    newValue?: unknown;
  }
>;

const OVERLAY_Z_INDEX = "2147483646";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let enabled = false;
    let hoveredElement: Element | null = null;
    let selectedElement: Element | null = null;
    let overlay: OverlayNodes | null = null;

    const isInspectableElement = (value: unknown): value is Element => {
      return value instanceof Element && !overlay?.host.contains(value);
    };

    const clamp = (value: number, min: number, max: number) => {
      return Math.min(Math.max(value, min), max);
    };

    const describeElement = (element: Element) => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : "";
      const classNames = Array.from(element.classList)
        .slice(0, 2)
        .map((className) => `.${className}`)
        .join("");

      return `${tag}${id}${classNames}`;
    };

    const ensureOverlay = () => {
      if (overlay) {
        return overlay;
      }

      const host = document.createElement("div");
      host.setAttribute("data-snag-selector-overlay", "true");
      host.style.position = "fixed";
      host.style.inset = "0";
      host.style.pointerEvents = "none";
      host.style.zIndex = OVERLAY_Z_INDEX;

      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host {
          all: initial;
        }

        * {
          box-sizing: border-box;
        }

        .container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            "Courier New",
            monospace;
        }

        .highlight {
          position: fixed;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          border-radius: 18px;
          border: 1.5px solid rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.06);
          box-shadow:
            0 0 0 9999px rgba(15, 23, 42, 0.14),
            inset 0 0 0 1px rgba(255, 255, 255, 0.35);
          transition:
            transform 140ms ease,
            width 140ms ease,
            height 140ms ease,
            border-radius 140ms ease;
        }

        .label {
          position: fixed;
          min-width: 180px;
          max-width: min(320px, calc(100vw - 24px));
          border-radius: 18px;
          padding: 10px 12px;
          color: #f8fafc;
          background: rgba(15, 23, 42, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow:
            0 18px 40px rgba(15, 23, 42, 0.28),
            inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(18px);
        }

        .label-name,
        .label-meta {
          margin: 0;
        }

        .label-name {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #f8fafc;
        }

        .label-meta {
          margin-top: 6px;
          font-size: 10px;
          line-height: 1.5;
          letter-spacing: 0.04em;
          color: rgba(226, 232, 240, 0.82);
        }
      `;

      const container = document.createElement("div");
      container.className = "container";

      const highlight = document.createElement("div");
      highlight.className = "highlight";

      const label = document.createElement("div");
      label.className = "label";

      const labelName = document.createElement("p");
      labelName.className = "label-name";

      const labelMeta = document.createElement("p");
      labelMeta.className = "label-meta";

      label.append(labelName, labelMeta);
      container.append(highlight, label);
      shadow.append(style, container);
      document.documentElement.append(host);

      overlay = {
        host,
        container,
        highlight,
        label,
        labelName,
        labelMeta,
      };

      return overlay;
    };

    const hideHighlight = () => {
      if (!overlay) {
        return;
      }

      overlay.highlight.style.width = "0px";
      overlay.highlight.style.height = "0px";
      overlay.label.style.opacity = "0";
    };

    const updateHighlight = (element: Element | null) => {
      if (!enabled || !element) {
        hoveredElement = null;
        hideHighlight();
        return;
      }

      const nodes = ensureOverlay();
      const rect = element.getBoundingClientRect();

      if (rect.width < 1 || rect.height < 1) {
        hoveredElement = null;
        hideHighlight();
        return;
      }

      hoveredElement = element;

      const computed = window.getComputedStyle(element);
      const radius = computed.borderTopLeftRadius || "18px";
      const left = clamp(rect.left, 0, window.innerWidth);
      const top = clamp(rect.top, 0, window.innerHeight);

      nodes.highlight.style.transform = `translate(${left}px, ${top}px)`;
      nodes.highlight.style.width = `${rect.width}px`;
      nodes.highlight.style.height = `${rect.height}px`;
      nodes.highlight.style.borderRadius = radius;

      nodes.labelName.textContent = describeElement(element);
      nodes.labelMeta.textContent = selectedElement === element
        ? `${Math.round(rect.width)} x ${Math.round(rect.height)} px • selected`
        : `${Math.round(rect.width)} x ${Math.round(rect.height)} px`;
      nodes.label.style.opacity = "1";

      const labelRect = nodes.label.getBoundingClientRect();
      const labelLeft = clamp(rect.left, 12, window.innerWidth - labelRect.width - 12);
      const fitsAbove = rect.top - labelRect.height - 12 > 0;
      const labelTop = fitsAbove
        ? rect.top - labelRect.height - 12
        : Math.min(rect.bottom + 12, window.innerHeight - labelRect.height - 12);

      nodes.label.style.transform = `translate(${labelLeft}px, ${labelTop}px)`;
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (selectedElement) {
        return;
      }

      const nextTarget = isInspectableElement(event.target) ? event.target : null;
      updateHighlight(nextTarget);
    };

    const handleScrollOrResize = () => {
      updateHighlight(selectedElement ?? hoveredElement);
    };

    const handleClick = (event: MouseEvent) => {
      const nextTarget = isInspectableElement(event.target) ? event.target : null;
      if (!nextTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      selectedElement = nextTarget;
      hoveredElement = nextTarget;
      updateHighlight(nextTarget);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();

        if (selectedElement) {
          selectedElement = null;
          updateHighlight(hoveredElement);
          return;
        }

        void setSelectorEnabled(false);
      }
    };

    const mountOverlay = () => {
      ensureOverlay();
      window.addEventListener("mousemove", handlePointerMove, true);
      window.addEventListener("click", handleClick, true);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize, true);
      window.addEventListener("keydown", handleKeydown, true);
    };

    const unmountOverlay = () => {
      window.removeEventListener("mousemove", handlePointerMove, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize, true);
      window.removeEventListener("keydown", handleKeydown, true);
      hoveredElement = null;
      selectedElement = null;

      if (!overlay) {
        return;
      }

      overlay.host.remove();
      overlay = null;
    };

    const handleStorageChange = (
      changes: StorageChangeMap,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[SELECTOR_ENABLED_KEY]) {
        return;
      }

      const nextEnabled = changes[SELECTOR_ENABLED_KEY].newValue === true;
      if (nextEnabled === enabled) {
        return;
      }

      enabled = nextEnabled;
      if (enabled) {
        mountOverlay();
      } else {
        unmountOverlay();
      }
    };

    void getSelectorEnabled().then((initialEnabled) => {
      enabled = initialEnabled;
      if (enabled) {
        mountOverlay();
      }
    });

    browser.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener(
      "pagehide",
      () => {
        browser.storage.onChanged.removeListener(handleStorageChange);
        unmountOverlay();
      },
      { once: true },
    );
  },
});
