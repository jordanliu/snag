import { createServer } from "node:http";
import {
  bridgeIncomingMessageSchema,
  type BridgeCommand,
  type CommandResultMessage,
  type SelectedElementSnapshot,
} from "@repo/dom-bridge";
import { WebSocket, WebSocketServer } from "ws";

const BRIDGE_HOST = "127.0.0.1";
const BRIDGE_PORT = 57821;
const COMMAND_TIMEOUT_MS = 5_000;

type ActiveSelection = {
  snapshot: SelectedElementSnapshot;
  tabId: number;
  frameId?: number;
};

type PendingCommand = {
  resolve: (value: CommandResultMessage) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
};

export class WebSocketBridge {
  private server?: ReturnType<typeof createServer>;
  private socketServer?: WebSocketServer;
  private activeClient: WebSocket | null = null;
  private latestSelection: ActiveSelection | null = null;
  private pendingCommands = new Map<string, PendingCommand>();

  async start(): Promise<void> {
    if (this.server && this.socketServer) {
      return;
    }

    const server = createServer();
    const socketServer = new WebSocketServer({ server });

    socketServer.on("error", (error) => {
      console.error("Bridge websocket server error:", error);
    });

    socketServer.on("connection", (client) => {
      console.log(`Extension bridge connected at ws://${BRIDGE_HOST}:${BRIDGE_PORT}`);
      this.attachClient(client);
    });

    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error) => {
        server.off("listening", handleListening);
        reject(error);
      };

      const handleListening = () => {
        server.off("error", handleError);
        resolve();
      };

      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(BRIDGE_PORT, BRIDGE_HOST);
    });

    console.log(`DOM bridge listening on ws://${BRIDGE_HOST}:${BRIDGE_PORT}`);

    this.server = server;
    this.socketServer = socketServer;
  }

  async close(): Promise<void> {
    this.rejectPendingCommands("The bridge server is shutting down.");
    this.latestSelection = null;

    if (this.activeClient) {
      this.activeClient.close();
      this.activeClient = null;
    }

    await Promise.all([
      new Promise<void>((resolve) => {
        if (!this.socketServer) {
          resolve();
          return;
        }

        this.socketServer.close(() => resolve());
      }),
      new Promise<void>((resolve) => {
        if (!this.server) {
          resolve();
          return;
        }

        this.server.close(() => resolve());
      }),
    ]);

    this.socketServer = undefined;
    this.server = undefined;
  }

  isExtensionConnected(): boolean {
    return this.activeClient?.readyState === WebSocket.OPEN;
  }

  getSelectedElement(): ActiveSelection | null {
    return this.latestSelection;
  }

  async sendCommand(command: BridgeCommand): Promise<CommandResultMessage> {
    const client = this.activeClient;
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error(
        "The browser extension bridge is not connected. Start the extension and wait for it to connect.",
      );
    }

    return await new Promise<CommandResultMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(command.id);
        reject(
          new Error(
            "Timed out waiting for the browser extension to acknowledge the DOM update.",
          ),
        );
      }, COMMAND_TIMEOUT_MS);

      this.pendingCommands.set(command.id, {
        resolve,
        reject,
        timeout,
      });

      console.log("Sending DOM command to extension:", summarizeCommand(command));

      client.send(JSON.stringify(command), (error) => {
        if (!error) {
          return;
        }

        const pending = this.pendingCommands.get(command.id);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timeout);
        this.pendingCommands.delete(command.id);
        reject(error);
      });
    });
  }

  private attachClient(client: WebSocket) {
    if (this.activeClient && this.activeClient !== client) {
      this.activeClient.close(1000, "Replacing stale bridge client.");
    }

    this.activeClient = client;

    client.on("message", (payload) => {
      this.handleClientMessage(payload).catch((error: unknown) => {
        console.error("Failed to handle bridge message:", error);
      });
    });

    client.on("close", () => {
      if (this.activeClient !== client) {
        return;
      }

      console.log("Extension bridge disconnected.");
      this.activeClient = null;
      this.latestSelection = null;
      this.rejectPendingCommands(
        "The browser extension bridge disconnected before the command completed.",
      );
    });

    client.on("error", (error) => {
      console.error("Bridge websocket error:", error);
    });
  }

  private async handleClientMessage(
    payload: Parameters<WebSocket["emit"]>[1],
  ): Promise<void> {
    const text = typeof payload === "string" ? payload : payload.toString();
    const rawMessage: unknown = JSON.parse(text);
    const parsed = bridgeIncomingMessageSchema.safeParse(rawMessage);

    if (!parsed.success) {
      console.error("Ignoring invalid bridge payload:", parsed.error.flatten());
      return;
    }

    const message = parsed.data;

    switch (message.type) {
      case "selection_changed":
        console.log("Received selected element from extension:", {
          selector: message.snapshot.selector,
          tagName: message.snapshot.tagName,
          tabId: message.tabId,
          frameId: message.frameId,
          url: message.snapshot.url,
        });
        this.latestSelection = {
          snapshot: message.snapshot,
          tabId: message.tabId,
          frameId: message.frameId,
        };
        return;

      case "selection_cleared":
        console.log("Received selection cleared from extension:", {
          reason: message.reason,
          tabId: message.tabId,
          frameId: message.frameId,
          url: message.url,
        });
        this.latestSelection = null;
        return;

      case "command_result": {
        console.log("Received command result from extension:", {
          id: message.id,
          ok: message.ok,
          selector: message.selector,
          message: message.message,
        });
        const pending = this.pendingCommands.get(message.id);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timeout);
        this.pendingCommands.delete(message.id);

        if (message.ok && message.snapshot && this.latestSelection) {
          this.latestSelection = {
            ...this.latestSelection,
            snapshot: message.snapshot,
          };
        }

        pending.resolve(message);
      }
    }
  }

  private rejectPendingCommands(message: string) {
    for (const [commandId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
      this.pendingCommands.delete(commandId);
    }
  }
}

export function formatSelectionSummary(snapshot: SelectedElementSnapshot): string {
  return `${snapshot.tagName} at ${snapshot.selector}`;
}

function summarizeCommand(command: BridgeCommand) {
  switch (command.type) {
    case "modify_styles":
      return {
        id: command.id,
        type: command.type,
        selector: command.selector,
        styles: command.styles,
      };

    case "modify_content":
      return {
        id: command.id,
        type: command.type,
        selector: command.selector,
        html: command.html,
        textContent: command.textContent,
      };

    case "modify_attributes":
      return {
        id: command.id,
        type: command.type,
        selector: command.selector,
        attributes: command.attributes,
      };
  }
}
