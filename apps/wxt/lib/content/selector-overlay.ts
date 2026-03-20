type OverlayNodes = {
  host: HTMLDivElement;
  highlight: HTMLDivElement;
  label: HTMLDivElement;
  labelName: HTMLParagraphElement;
  labelMeta: HTMLParagraphElement;
};

const OVERLAY_Z_INDEX = "2147483646";

export class SelectorOverlay {
  private nodes: OverlayNodes | null = null;

  isOverlayElement(value: unknown): value is Element {
    return value instanceof Element && this.nodes?.host.contains(value) === true;
  }

  show(element: Element, label: string, isSelected: boolean) {
    const nodes = this.ensureNodes();
    const rect = element.getBoundingClientRect();

    if (rect.width < 1 || rect.height < 1) {
      this.hide();
      return false;
    }

    const computed = window.getComputedStyle(element);
    const radius = computed.borderTopLeftRadius || "18px";
    const left = clamp(rect.left, 0, window.innerWidth);
    const top = clamp(rect.top, 0, window.innerHeight);

    nodes.highlight.style.transform = `translate(${left}px, ${top}px)`;
    nodes.highlight.style.width = `${rect.width}px`;
    nodes.highlight.style.height = `${rect.height}px`;
    nodes.highlight.style.borderRadius = radius;

    nodes.labelName.textContent = label;
    nodes.labelMeta.textContent = isSelected
      ? `${Math.round(rect.width)} x ${Math.round(rect.height)} px • selected`
      : `${Math.round(rect.width)} x ${Math.round(rect.height)} px`;
    nodes.label.style.opacity = "1";

    const labelRect = nodes.label.getBoundingClientRect();
    const labelLeft = clamp(
      rect.left,
      12,
      window.innerWidth - labelRect.width - 12,
    );
    const fitsAbove = rect.top - labelRect.height - 12 > 0;
    const labelTop = fitsAbove
      ? rect.top - labelRect.height - 12
      : Math.min(
          rect.bottom + 12,
          window.innerHeight - labelRect.height - 12,
        );

    nodes.label.style.transform = `translate(${labelLeft}px, ${labelTop}px)`;
    return true;
  }

  hide() {
    if (!this.nodes) {
      return;
    }

    this.nodes.highlight.style.width = "0px";
    this.nodes.highlight.style.height = "0px";
    this.nodes.label.style.opacity = "0";
  }

  destroy() {
    if (!this.nodes) {
      return;
    }

    this.nodes.host.remove();
    this.nodes = null;
  }

  private ensureNodes() {
    if (this.nodes) {
      return this.nodes;
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

    this.nodes = {
      host,
      highlight,
      label,
      labelName,
      labelMeta,
    };

    return this.nodes;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
