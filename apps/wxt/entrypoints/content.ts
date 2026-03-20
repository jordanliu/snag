import { startSelectorSession } from "../lib/content/selector-session";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    startSelectorSession();
  },
});
