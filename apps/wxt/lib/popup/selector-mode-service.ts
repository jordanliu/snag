import {
  BRIDGE_CONNECTED_KEY,
  getBridgeConnected,
  getSelectorEnabled,
  SELECTOR_ENABLED_KEY,
  setSelectorEnabled,
} from "../selector-mode";
import { selectorSessionStatusMessageSchema } from "../selection-messages";
import {
  type BridgeConfig,
  getBridgeConfig,
  setBridgeConfig,
} from "../bridge-config";

type StorageChangeMap = Record<
  string,
  {
    oldValue?: unknown;
    newValue?: unknown;
  }
>;

export type SelectorModeState = {
  enabled: boolean;
  bridgeConnected: boolean;
  bridgeHost: string;
  bridgePort: string;
};

const UNSUPPORTED_TAB_ERROR =
  "Selector mode only works on regular http or https pages, not browser or extension pages.";
const MISSING_TAB_ERROR = "Open a normal webpage tab before enabling selector mode.";
const SELECTOR_ACTIVATION_ERROR =
  "Unable to activate selector mode on this tab right now. Try enabling it again.";

export async function loadSelectorModeState(): Promise<SelectorModeState> {
  const [enabled, bridgeConnected, bridgeConfig] = await Promise.all([
    getSelectorEnabled(),
    getBridgeConnected(),
    getBridgeConfig(),
  ]);

  return {
    enabled,
    bridgeConnected,
    bridgeHost: bridgeConfig.host,
    bridgePort: String(bridgeConfig.port),
  };
}

export function subscribeToSelectorModeState(
  onChange: (state: Partial<SelectorModeState>) => void,
) {
  const handleStorageChange = (changes: StorageChangeMap, areaName: string) => {
    if (areaName !== "local") {
      return;
    }

    const nextState: Partial<SelectorModeState> = {};

    if (changes[SELECTOR_ENABLED_KEY]) {
      nextState.enabled = changes[SELECTOR_ENABLED_KEY].newValue === true;
    }

    if (changes[BRIDGE_CONNECTED_KEY]) {
      nextState.bridgeConnected = changes[BRIDGE_CONNECTED_KEY].newValue === true;
    }

    if (Object.keys(nextState).length > 0) {
      onChange(nextState);
    }
  };

  browser.storage.onChanged.addListener(handleStorageChange);

  return () => {
    browser.storage.onChanged.removeListener(handleStorageChange);
  };
}

export async function enableSelectorMode(): Promise<void> {
  const activeTab = await getSupportedActiveTab();
  await injectSelectorContentScript(activeTab.id);
  await setSelectorEnabled(true);
}

export async function disableSelectorMode(): Promise<void> {
  await setSelectorEnabled(false);
}

export async function saveBridgeConfig(input: {
  host: string;
  port: string;
}): Promise<BridgeConfig> {
  const host = input.host.trim();
  const parsedPort = Number(input.port);

  if (host.length === 0) {
    throw new Error("Enter a bridge host before saving.");
  }

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error("Enter a valid bridge port between 1 and 65535.");
  }

  const config = {
    host,
    port: parsedPort,
  };

  await setBridgeConfig(config);
  return config;
}

async function getSupportedActiveTab(): Promise<{ id: number; url: string }> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id || !activeTab.url) {
    throw new Error(MISSING_TAB_ERROR);
  }

  if (!/^https?:/i.test(activeTab.url)) {
    throw new Error(UNSUPPORTED_TAB_ERROR);
  }

  return {
    id: activeTab.id,
    url: activeTab.url,
  };
}

async function injectSelectorContentScript(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      files: ["/content-scripts/content.js"],
    });
  } catch {
    throw new Error(SELECTOR_ACTIVATION_ERROR);
  }
}
