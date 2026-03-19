import { useEffect, useState } from "react";
import { Button } from "@repo/ui/button";
import {
  getSelectorEnabled,
  SELECTOR_ENABLED_KEY,
  setSelectorEnabled,
} from "../../lib/selector-mode";

type StorageChangeMap = Record<
  string,
  {
    oldValue?: unknown;
    newValue?: unknown;
  }
>;

function App() {
  const [enabled, setEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getSelectorEnabled().then((value) => {
      if (!cancelled) {
        setEnabled(value);
      }
    });

    const handleStorageChange = (
      changes: StorageChangeMap,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[SELECTOR_ENABLED_KEY]) {
        return;
      }

      setEnabled(changes[SELECTOR_ENABLED_KEY].newValue === true);
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const updateSelectorMode = async (nextEnabled: boolean) => {
    setIsSaving(true);
    try {
      await setSelectorEnabled(nextEnabled);
      setEnabled(nextEnabled);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-[520px] flex-col justify-between bg-black px-5 py-5 text-white">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-white/45">
            snag
          </p>
          <h1 className="font-body text-base font-medium tracking-[0.08em] text-white">
            selector mode
          </h1>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/4 p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-white/45">
            status
          </p>
          <p className="mt-3 font-body text-sm leading-6 text-white">
            {enabled ? "enabled" : "disabled"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          aria-label="Enable selector mode"
          className="w-full border-white bg-white text-black shadow-none hover:bg-white/92"
          disabled={enabled || isSaving}
          onClick={() => void updateSelectorMode(true)}
        >
          {isSaving && !enabled ? "..." : "enable"}
        </Button>
        <Button
          aria-label="Disable selector mode"
          className="w-full border-white/22 bg-transparent text-white shadow-none hover:border-white hover:bg-white/8"
          disabled={!enabled || isSaving}
          onClick={() => void updateSelectorMode(false)}
          tone="ghost"
        >
          {isSaving && enabled ? "..." : "disable"}
        </Button>
      </div>
    </main>
  );
}

export default App;
