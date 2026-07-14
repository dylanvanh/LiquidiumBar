import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function usePanelLifecycle(): boolean {
  const queryClient = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(!isTauri());

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void getCurrentWindow()
      .isVisible()
      .then((visible) => {
        if (!disposed) setPanelOpen(visible);
      });

    void listen("panel-opened", () => {
      setPanelOpen(true);
      void queryClient.refetchQueries({ type: "active", stale: true });
    }).then((unlisten) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    });

    void listen("panel-closed", () => setPanelOpen(false)).then((unlisten) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    });

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [queryClient]);

  return panelOpen;
}
