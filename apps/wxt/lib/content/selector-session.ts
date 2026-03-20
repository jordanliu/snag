import {
  bridgeCommandSchema,
  type BridgeCommand,
  type CommandResultMessage,
} from "@repo/dom-bridge";
import {
  isClearPageSelectionRuntimeMessage,
  isSelectorSessionProbeMessage,
  type SelectorSessionStatusMessage,
} from "../selection-messages";
import {
  getSelectorEnabled,
  SELECTOR_ENABLED_KEY,
  setSelectorEnabled,
} from "../selector-mode";
import { executeBridgeCommand } from "./bridge-command-runner";
import { SelectorOverlay } from "./selector-overlay";
import {
  sendSelectionChanged,
  sendSelectionCleared,
} from "./selection-bridge";

type StorageChangeMap = Record<
  string,
  {
    oldValue?: unknown;
    newValue?: unknown;
  }
>;

const SELECTOR_SESSION_KEY = "__snagSelectorSession";

type SelectorSessionWindow = Window & {
  [SELECTOR_SESSION_KEY]?: SelectorSession;
};

export function startSelectorSession() {
  const existingSession = getSelectorSession();
  if (existingSession) {
    return existingSession;
  }

  const session = new SelectorSession();
  getSelectorSessionWindow()[SELECTOR_SESSION_KEY] = session;
  session.start();
  return session;
}

export function getSelectorSession(): SelectorSession | null {
  return getSelectorSessionWindow()[SELECTOR_SESSION_KEY] ?? null;
}

export function stopSelectorSession(): void {
  const session = getSelectorSession();
  if (!session) {
    return;
  }

  session.stop({
    clearReason: "Selector mode was disabled.",
    notifyBridge: false,
  });
}

class SelectorSession {
  private started = false;
  private listenersAttached = false;
  private enabled = false;
  private hoveredElement: Element | null = null;
  private selectedElement: Element | null = null;
  private overlay = new SelectorOverlay();

  start() {
    if (this.started) {
      return;
    }

    this.started = true;

    void getSelectorEnabled().then((initialEnabled) => {
      this.enabled = initialEnabled;
      if (this.enabled) {
        this.enableSelector();
      }
    });

    browser.storage.onChanged.addListener(this.handleStorageChange);
    browser.runtime.onMessage.addListener(this.handleRuntimeMessage);
    window.addEventListener("pagehide", this.handlePageHide, { once: true });
  }

  stop(options: {
    clearReason: string;
    notifyBridge: boolean;
  }) {
    if (!this.started) {
      clearStoredSelectorSession(this);
      return;
    }

    browser.storage.onChanged.removeListener(this.handleStorageChange);
    browser.runtime.onMessage.removeListener(this.handleRuntimeMessage);
    window.removeEventListener("pagehide", this.handlePageHide);
    this.disableSelector(options);
    this.started = false;
    clearStoredSelectorSession(this);
  }

  private readonly handleStorageChange = (
    changes: StorageChangeMap,
    areaName: string,
  ) => {
    if (areaName !== "local" || !changes[SELECTOR_ENABLED_KEY]) {
      return;
    }

    const nextEnabled = changes[SELECTOR_ENABLED_KEY].newValue === true;
    if (nextEnabled === this.enabled) {
      return;
    }

    this.enabled = nextEnabled;
    if (this.enabled) {
      this.enableSelector();
    } else {
      this.disableSelector({
        clearReason: "Selector mode was disabled.",
        notifyBridge: true,
      });
    }
  };

  private readonly handleRuntimeMessage = (message: unknown) => {
    if (isSelectorSessionProbeMessage(message)) {
      const response: SelectorSessionStatusMessage = {
        type: "selector_session_status",
        ready: true,
        enabled: this.enabled,
      };

      return response;
    }

    if (isClearPageSelectionRuntimeMessage(message)) {
      this.clearPageSelection({
        reason: message.reason,
        notifyBridge: false,
        preserveHover: false,
      });
      return undefined;
    }

    const parsed = bridgeCommandSchema.safeParse(message);
    if (!parsed.success) {
      return undefined;
    }

    return this.applyBridgeCommand(parsed.data);
  };

  private readonly handlePageHide = () => {
    this.stop({
      clearReason: "The page was unloaded.",
      notifyBridge: true,
    });
  };

  private readonly handlePointerMove = (event: MouseEvent) => {
    if (this.selectedElement) {
      return;
    }

    const nextTarget = this.getInspectableElement(event.target);
    this.updateHighlight(nextTarget);
  };

  private readonly handleScrollOrResize = () => {
    this.updateHighlight(this.selectedElement ?? this.hoveredElement);
  };

  private readonly handleClick = (event: MouseEvent) => {
    const nextTarget = this.getInspectableElement(event.target);
    if (!nextTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    this.selectedElement = nextTarget;
    this.hoveredElement = nextTarget;
    this.updateHighlight(nextTarget);

    console.log("Snag selector click selected:", describeElement(nextTarget));
    this.sendSelectionChanged(nextTarget);
  };

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this.selectedElement) {
      this.clearPageSelection({
        reason: "The page selection was cleared.",
        notifyBridge: true,
        preserveHover: true,
      });
      return;
    }

    void setSelectorEnabled(false);
  };

  private enableSelector() {
    if (this.listenersAttached) {
      return;
    }

    this.overlay.show(document.documentElement, "html", false);
    this.overlay.hide();
    window.addEventListener("mousemove", this.handlePointerMove, true);
    window.addEventListener("click", this.handleClick, true);
    window.addEventListener("scroll", this.handleScrollOrResize, true);
    window.addEventListener("resize", this.handleScrollOrResize, true);
    window.addEventListener("keydown", this.handleKeydown, true);
    this.listenersAttached = true;
  }

  private disableSelector(options: {
    clearReason?: string;
    notifyBridge: boolean;
  }) {
    if (this.listenersAttached) {
      window.removeEventListener("mousemove", this.handlePointerMove, true);
      window.removeEventListener("click", this.handleClick, true);
      window.removeEventListener("scroll", this.handleScrollOrResize, true);
      window.removeEventListener("resize", this.handleScrollOrResize, true);
      window.removeEventListener("keydown", this.handleKeydown, true);
      this.listenersAttached = false;
    }

    this.hoveredElement = null;
    if (this.selectedElement) {
      this.clearPageSelection({
        reason: options.clearReason ?? "Selector mode was disabled.",
        notifyBridge: options.notifyBridge,
        preserveHover: false,
      });
    } else {
      this.overlay.hide();
    }

    this.overlay.destroy();
  }

  private clearPageSelection(options: {
    reason: string;
    notifyBridge: boolean;
    preserveHover: boolean;
  }) {
    if (!this.selectedElement) {
      return;
    }

    this.selectedElement = null;
    if (!options.preserveHover) {
      this.hoveredElement = null;
    }

    if (options.notifyBridge) {
      this.sendSelectionCleared(options.reason);
    }

    this.updateHighlight(options.preserveHover ? this.hoveredElement : null);
  }

  private updateHighlight(element: Element | null) {
    if (!this.enabled || !element) {
      this.hoveredElement = null;
      this.overlay.hide();
      return;
    }

    this.hoveredElement = element;
    const didShow = this.overlay.show(
      element,
      describeElement(element),
      this.selectedElement === element,
    );

    if (!didShow) {
      this.hoveredElement = null;
    }
  }

  private getInspectableElement(value: unknown): Element | null {
    if (!(value instanceof Element)) {
      return null;
    }

    return this.overlay.isOverlayElement(value) ? null : value;
  }

  private sendSelectionChanged(element: Element) {
    sendSelectionChanged(element);
  }

  private sendSelectionCleared(reason: string) {
    sendSelectionCleared(reason);
  }

  private applyBridgeCommand(command: BridgeCommand): CommandResultMessage {
    const { result, targetElement } = executeBridgeCommand(command);
    if (result.ok && targetElement && this.selectedElement === targetElement) {
      this.updateHighlight(targetElement);
    }

    return result;
  }
}

function describeElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classNames = Array.from(element.classList)
    .slice(0, 2)
    .map((className) => `.${className}`)
    .join("");

  return `${tag}${id}${classNames}`;
}

function getSelectorSessionWindow(): SelectorSessionWindow {
  return window as SelectorSessionWindow;
}

function clearStoredSelectorSession(session: SelectorSession) {
  const sessionWindow = getSelectorSessionWindow();
  if (sessionWindow[SELECTOR_SESSION_KEY] === session) {
    delete sessionWindow[SELECTOR_SESSION_KEY];
  }
}
