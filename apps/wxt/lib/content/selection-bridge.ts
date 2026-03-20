import {
  type SelectionChangedRuntimeMessage,
  type SelectionClearedRuntimeMessage,
} from "../selection-messages";
import { createSelectedElementSnapshot } from "../selected-element";

export function sendSelectionChanged(element: Element) {
  const snapshot = createSelectedElementSnapshot(element);
  console.log("Snag selector captured element:", {
    selector: snapshot.selector,
    tagName: snapshot.tagName,
    url: snapshot.url,
  });

  const message: SelectionChangedRuntimeMessage = {
    type: "content_selection_changed",
    snapshot,
  };

  void browser.runtime.sendMessage(message);
}

export function sendSelectionCleared(reason: string) {
  console.log("Snag selector cleared:", reason);

  const message: SelectionClearedRuntimeMessage = {
    type: "content_selection_cleared",
    reason,
    url: window.location.href,
  };

  void browser.runtime.sendMessage(message);
}
