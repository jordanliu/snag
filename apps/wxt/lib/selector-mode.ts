export const SELECTOR_ENABLED_KEY = "selectorEnabled";

export async function getSelectorEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(SELECTOR_ENABLED_KEY);
  return stored[SELECTOR_ENABLED_KEY] === true;
}

export async function setSelectorEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({
    [SELECTOR_ENABLED_KEY]: enabled,
  });
}
