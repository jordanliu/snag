import {
  BRIDGE_CONNECTED_KEY,
  getBridgeConnected,
  getSelectorEnabled,
  SELECTOR_ENABLED_KEY,
  setSelectorEnabled,
} from "../selector-mode";
import { selectorSessionStatusMessageSchema } from "../selection-messages";

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
};

const UNSUPPORTED_TAB_ERROR =
  "Selector mode only works on regular http or https pages, not browser or extension pages.";
const MISSING_TAB_ERROR = "Open a normal webpage tab before enabling selector mode.";
const RELOAD_REQUIRED_ERROR =
  "Reload this page once after loading or updating the extension, then enable selector mode again.";

export async function loadSelectorModeState(): Promise<SelectorModeState> {
  const [enabled, bridgeConnected] = await Promise.all([
    getSelectorEnabled(),
    getBridgeConnected(),
  ]);

  return {
    enabled,
    bridgeConnected,
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
  await assertSelectorSessionReady(activeTab.id);
  await setSelectorEnabled(true);
}

export async function disableSelectorMode(): Promise<void> {
  await setSelectorEnabled(false);
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

async function assertSelectorSessionReady(tabId: number): Promise<void> {
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      type: "selector_session_probe",
    });
    const parsed = selectorSessionStatusMessageSchema.safeParse(response);

    if (!parsed.success || parsed.data.ready !== true) {
      throw new Error(RELOAD_REQUIRED_ERROR);
    }
  } catch {
    throw new Error(RELOAD_REQUIRED_ERROR);
  }
}
