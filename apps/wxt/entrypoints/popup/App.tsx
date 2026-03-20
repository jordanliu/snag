import { useEffect, useState } from "react";
import { Button } from "@repo/ui/button";
import {
  disableSelectorMode,
  enableSelectorMode,
  loadSelectorModeState,
  subscribeToSelectorModeState,
  type SelectorModeState,
} from "../../lib/popup/selector-mode-service";

function App() {
  const [selectorModeState, setSelectorModeState] = useState<SelectorModeState>({
    enabled: false,
    bridgeConnected: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSelectorModeState().then((state) => {
      if (!cancelled) {
        setSelectorModeState(state);
      }
    });

    const unsubscribe = subscribeToSelectorModeState((state) => {
      setSelectorModeState((currentState) => {
        return {
          ...currentState,
          ...state,
        };
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const updateSelectorMode = async (nextEnabled: boolean) => {
    setIsSaving(true);
    setActivationError(null);
    try {
      if (nextEnabled) {
        await enableSelectorMode();
      } else {
        await disableSelectorMode();
      }
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? error.message
          : "Unable to activate selector mode on this tab.",
      );
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
            {selectorModeState.enabled ? "enabled" : "disabled"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/4 p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-white/45">
            mcp bridge
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${
                selectorModeState.bridgeConnected ? "bg-emerald-300" : "bg-rose-300"
              }`}
            />
            <p className="font-body text-sm leading-6 text-white">
              {selectorModeState.bridgeConnected ? "connected" : "disconnected"}
            </p>
          </div>
        </div>

        {activationError ? (
          <div className="rounded-2xl border border-rose-200/20 bg-rose-50/6 p-4">
            <p className="font-body text-[10px] uppercase tracking-[0.22em] text-rose-200/70">
              selector note
            </p>
            <p className="mt-3 font-body text-sm leading-6 text-rose-100">
              {activationError}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          aria-label="Enable selector mode"
          className="w-full border-white bg-white text-black shadow-none hover:bg-white/92"
          disabled={selectorModeState.enabled || isSaving}
          onClick={() => void updateSelectorMode(true)}
        >
          {isSaving && !selectorModeState.enabled ? "..." : "enable"}
        </Button>
        <Button
          aria-label="Disable selector mode"
          className="w-full border-white/22 bg-transparent text-white shadow-none hover:border-white hover:bg-white/8"
          disabled={!selectorModeState.enabled || isSaving}
          onClick={() => void updateSelectorMode(false)}
          tone="ghost"
        >
          {isSaving && selectorModeState.enabled ? "..." : "disable"}
        </Button>
      </div>
    </main>
  );
}

export default App;
