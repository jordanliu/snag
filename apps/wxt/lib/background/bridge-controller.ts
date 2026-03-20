import {
  bridgeCommandSchema,
  commandResultMessageSchema,
  type CommandResultMessage,
  type SelectionChangedMessage,
  type SelectionClearedMessage,
  type SelectedElementSnapshot,
} from "@repo/dom-bridge";
import {
  isSelectionChangedRuntimeMessage,
  isSelectionClearedRuntimeMessage,
  type ClearPageSelectionRuntimeMessage,
} from "../selection-messages";
import { setBridgeConnected } from "../selector-mode";
import {
  BRIDGE_HOST_KEY,
  BRIDGE_PORT_KEY,
  buildBridgeUrl,
  getBridgeConfig,
} from "../bridge-config";

const RECONNECT_DELAY_MS = 1_500;

type ActiveSelection = {
  snapshot: SelectedElementSnapshot;
  tabId: number;
  frameId?: number;
};

type BridgeMessage =
  | SelectionChangedMessage
  | SelectionClearedMessage
  | CommandResultMessage;

type InstalledDetails = Parameters<
  Parameters<typeof browser.runtime.onInstalled.addListener>[0]
>[0];
type RuntimeMessageSender = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[1];
type TabUpdatedChangeInfo = Parameters<
  Parameters<typeof browser.tabs.onUpdated.addListener>[0]
>[1];

export function startBridgeController() {
  const controller = new BridgeController();
  controller.start();
}

class BridgeController {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSelection: ActiveSelection | null = null;
  private bridgeUrl = "";

  start() {
    void setBridgeConnected(false);

    browser.runtime.onInstalled.addListener(this.handleInstalled);
    browser.runtime.onMessage.addListener(this.handleRuntimeMessage);
    browser.storage.onChanged.addListener(this.handleStorageChange);
    browser.tabs.onRemoved.addListener(this.handleTabRemoved);
    browser.tabs.onUpdated.addListener(this.handleTabUpdated);

    void this.connectBridge();
  }

  private readonly handleInstalled = (details: InstalledDetails) => {
    if (details.reason !== "install") {
      return;
    }

    void browser.storage.local.set({
      selectorEnabled: false,
      bridgeConnected: false,
    });
  };

  private readonly handleStorageChange = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
  ) => {
    if (
      areaName !== "local"
      || (!changes[BRIDGE_HOST_KEY] && !changes[BRIDGE_PORT_KEY])
    ) {
      return;
    }

    void this.restartBridgeConnection();
  };

  private readonly handleRuntimeMessage = (
    message: unknown,
    sender: RuntimeMessageSender,
  ) => {
    if (isSelectionChangedRuntimeMessage(message)) {
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        return undefined;
      }

      console.log("Background received selected element:", {
        selector: message.snapshot.selector,
        tagName: message.snapshot.tagName,
        tabId,
        frameId: sender.frameId,
      });

      this.activeSelection = {
        snapshot: message.snapshot,
        tabId,
        frameId: sender.frameId,
      };

      this.sendSelectionChanged(message.snapshot, tabId, sender.frameId);
      return undefined;
    }

    if (isSelectionClearedRuntimeMessage(message)) {
      const tabId = sender.tab?.id;
      console.log("Background received selection clear:", {
        reason: message.reason,
        tabId,
        frameId: sender.frameId,
      });

      this.clearActiveSelection(message.reason, (selection) => {
        return selection.tabId === tabId && selection.frameId === sender.frameId;
      });
    }

    return undefined;
  };

  private readonly handleTabRemoved = (tabId: number) => {
    this.clearActiveSelection("The selected tab was closed.", (selection) => {
      return selection.tabId === tabId;
    });
  };

  private readonly handleTabUpdated = (
    tabId: number,
    changeInfo: TabUpdatedChangeInfo,
  ) => {
    if (!this.activeSelection || this.activeSelection.tabId !== tabId) {
      return;
    }

    if (changeInfo.status === "loading" || changeInfo.url !== undefined) {
      this.clearActiveSelection(
        "The selected tab navigated to a new page.",
        (selection) => {
        return selection.tabId === tabId;
        },
      );
    }
  };

  private async connectBridge() {
    if (
      this.socket
      && (this.socket.readyState === WebSocket.OPEN
        || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const config = await getBridgeConfig();
    const bridgeUrl = buildBridgeUrl(config);
    this.bridgeUrl = bridgeUrl;

    const nextSocket = new WebSocket(bridgeUrl);
    this.socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      console.log(`Connected to MCP bridge at ${bridgeUrl}`);
      void setBridgeConnected(true);

      if (!this.activeSelection) {
        return;
      }

      this.sendSelectionChanged(
        this.activeSelection.snapshot,
        this.activeSelection.tabId,
        this.activeSelection.frameId,
      );
    });

    nextSocket.addEventListener("message", (event) => {
      void parseSocketPayload(event.data).then((payload) => {
        void this.handleBridgePayload(JSON.parse(payload));
      }).catch((error: unknown) => {
        console.error("Failed to process bridge command:", error);
      });
    });

    nextSocket.addEventListener("close", () => {
      if (this.socket !== nextSocket) {
        return;
      }

      console.warn("Disconnected from MCP bridge.");
      void this.clearPageSelection("The MCP bridge disconnected.");
      this.socket = null;
      this.activeSelection = null;
      void setBridgeConnected(false);
      this.scheduleReconnect();
    });

    nextSocket.addEventListener("error", (event) => {
      console.error("MCP bridge websocket error:", event);
      void setBridgeConnected(false);

      if (
        nextSocket.readyState === WebSocket.OPEN
        || nextSocket.readyState === WebSocket.CONNECTING
      ) {
        nextSocket.close();
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectBridge();
    }, RECONNECT_DELAY_MS);
  }

  private async restartBridgeConnection() {
    this.clearReconnectTimer();
    void setBridgeConnected(false);

    const previousSocket = this.socket;
    this.socket = null;

    if (
      previousSocket
      && (previousSocket.readyState === WebSocket.OPEN
        || previousSocket.readyState === WebSocket.CONNECTING)
    ) {
      previousSocket.close(1000, "Restarting MCP bridge connection.");
    }

    await this.connectBridge();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private sendBridgeMessage(message: BridgeMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Bridge send skipped because websocket is not open:", message.type);
      return;
    }

    console.log("Sending message to MCP bridge:", summarizeBridgeMessage(message));
    this.socket.send(JSON.stringify(message));
  }

  private clearActiveSelection(
    reason: string,
    matchesSelection?: (selection: ActiveSelection) => boolean,
  ) {
    if (!this.activeSelection) {
      return;
    }

    if (matchesSelection && !matchesSelection(this.activeSelection)) {
      return;
    }

    const selection = this.activeSelection;
    this.activeSelection = null;
    this.sendSelectionCleared(reason, selection);
  }

  private async clearPageSelection(reason: string) {
    if (!this.activeSelection) {
      return;
    }

    const message: ClearPageSelectionRuntimeMessage = {
      type: "background_clear_page_selection",
      reason,
    };

    try {
      await browser.tabs.sendMessage(
        this.activeSelection.tabId,
        message,
        this.activeSelection.frameId === undefined
          ? undefined
          : { frameId: this.activeSelection.frameId },
      );
    } catch (error) {
      console.warn("Unable to clear page selection UI:", error);
    }
  }

  private async handleBridgePayload(rawMessage: unknown) {
    const parsed = bridgeCommandSchema.safeParse(rawMessage);
    if (!parsed.success) {
      return;
    }

    const command = parsed.data;
    const selection = this.activeSelection;

    if (!selection) {
      this.sendBridgeMessage({
        type: "command_result",
        id: command.id,
        ok: false,
        selector: command.selector,
        message:
          "No selected element is available. Select an element in the extension before running DOM edit tools.",
      });
      return;
    }

    try {
      const response = await browser.tabs.sendMessage(
        selection.tabId,
        command,
        selection.frameId === undefined
          ? undefined
          : { frameId: selection.frameId },
      );

      const result = commandResultMessageSchema.safeParse(response);
      if (!result.success) {
        this.sendBridgeMessage({
          type: "command_result",
          id: command.id,
          ok: false,
          selector: command.selector,
          message:
            "The content script returned an invalid response while applying the DOM update.",
        });
        return;
      }

      if (result.data.ok && result.data.snapshot) {
        this.activeSelection = {
          ...selection,
          snapshot: result.data.snapshot,
        };
      }

      this.sendBridgeMessage(result.data);
    } catch (error) {
      this.clearActiveSelection(
        "The selected tab navigated away or no longer accepts DOM edits.",
      );
      this.sendBridgeMessage({
        type: "command_result",
        id: command.id,
        ok: false,
        selector: command.selector,
        message:
          error instanceof Error
            ? error.message
            : "Failed to deliver the DOM command to the page.",
      });
    }
  }

  private sendSelectionChanged(
    snapshot: SelectedElementSnapshot,
    tabId: number,
    frameId: number | undefined,
  ) {
    const message: SelectionChangedMessage = {
      type: "selection_changed",
      snapshot,
      tabId,
      frameId,
    };

    this.sendBridgeMessage(message);
  }

  private sendSelectionCleared(reason: string, selection: ActiveSelection) {
    const message: SelectionClearedMessage = {
      type: "selection_cleared",
      reason,
      tabId: selection.tabId,
      frameId: selection.frameId,
      url: selection.snapshot.url,
    };

    this.sendBridgeMessage(message);
  }
}

async function parseSocketPayload(
  data: string | Blob | ArrayBuffer,
): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return await data.text();
  }

  return new TextDecoder().decode(data);
}

function summarizeBridgeMessage(message: BridgeMessage) {
  switch (message.type) {
    case "selection_changed":
      return {
        type: message.type,
        selector: message.snapshot.selector,
        tabId: message.tabId,
        frameId: message.frameId,
      };

    case "command_result":
      return {
        type: message.type,
        id: message.id,
        ok: message.ok,
        selector: message.selector,
      };

    case "selection_cleared":
      return {
        type: message.type,
        reason: message.reason,
        tabId: message.tabId,
        frameId: message.frameId,
      };
  }
}
