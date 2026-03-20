export const SELECTOR_ENABLED_KEY = "selectorEnabled";
export const BRIDGE_CONNECTED_KEY = "bridgeConnected";

export async function getSelectorEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(SELECTOR_ENABLED_KEY);
  return stored[SELECTOR_ENABLED_KEY] === true;
}

export async function getBridgeConnected(): Promise<boolean> {
  const stored = await browser.storage.local.get(BRIDGE_CONNECTED_KEY);
  return stored[BRIDGE_CONNECTED_KEY] === true;
}

export async function setSelectorEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({
    [SELECTOR_ENABLED_KEY]: enabled,
  });
}

export async function setBridgeConnected(connected: boolean): Promise<void> {
  await browser.storage.local.set({
    [BRIDGE_CONNECTED_KEY]: connected,
  });
}
