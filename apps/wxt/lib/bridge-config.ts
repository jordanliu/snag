export const BRIDGE_HOST_KEY = "bridgeHost";
export const BRIDGE_PORT_KEY = "bridgePort";

export type BridgeConfig = {
  host: string;
  port: number;
};

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  host: "127.0.0.1",
  port: 57821,
};

export async function getBridgeConfig(): Promise<BridgeConfig> {
  const stored = await browser.storage.local.get([
    BRIDGE_HOST_KEY,
    BRIDGE_PORT_KEY,
  ]);

  const host = normalizeBridgeHost(stored[BRIDGE_HOST_KEY]);
  const port = normalizeBridgePort(stored[BRIDGE_PORT_KEY]);

  return {
    host,
    port,
  };
}

export async function setBridgeConfig(config: BridgeConfig): Promise<void> {
  await browser.storage.local.set({
    [BRIDGE_HOST_KEY]: normalizeBridgeHost(config.host),
    [BRIDGE_PORT_KEY]: normalizeBridgePort(config.port),
  });
}

export function buildBridgeUrl(config: BridgeConfig): string {
  return `ws://${config.host}:${config.port}`;
}

function normalizeBridgeHost(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_BRIDGE_CONFIG.host;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : DEFAULT_BRIDGE_CONFIG.host;
}

function normalizeBridgePort(value: unknown): number {
  const parsedPort = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    return DEFAULT_BRIDGE_CONFIG.port;
  }

  return parsedPort;
}
