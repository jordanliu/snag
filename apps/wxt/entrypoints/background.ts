export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") {
      return;
    }

    void browser.storage.local.set({
      selectorEnabled: false,
    });
  });
});
