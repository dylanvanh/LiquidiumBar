import { useState } from "react";
import { MarketsView } from "./MarketsView";
import { usePanelLifecycle } from "./usePanelLifecycle";

type AppSection = "markets" | "portfolio" | "settings";

const sections: ReadonlyArray<{ id: AppSection; label: string }> = [
  { id: "markets", label: "Markets" },
  { id: "portfolio", label: "Portfolio" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [section, setSection] = useState<AppSection>("markets");
  const panelOpen = usePanelLifecycle();

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="wordmark">
          <span className="wordmark-glyph" aria-hidden="true">
            L
          </span>
          <span>LiqWatch</span>
        </div>
        <span className="read-only-badge">Read only</span>
      </header>

      <nav className="section-tabs" aria-label="LiqWatch sections">
        {sections.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={section === id ? "section-tab active" : "section-tab"}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "markets" ? (
        <MarketsView panelOpen={panelOpen} />
      ) : (
        <section className="coming-soon" aria-live="polite">
          <p className="eyebrow">Next milestone</p>
          <h1>{section === "portfolio" ? "Portfolio monitoring" : "Preferences"}</h1>
          <p>
            {section === "portfolio"
              ? "Add a Liquidium profile to monitor read-only positions."
              : "Refresh cadence and startup controls will live here."}
          </p>
        </section>
      )}
    </main>
  );
}
