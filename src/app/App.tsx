import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MarketsView } from "./MarketsView";
import { PortfolioView } from "./PortfolioView";
import { usePanelLifecycle } from "./usePanelLifecycle";

type AppSection = "markets" | "portfolio" | "settings";

const sections: ReadonlyArray<{ id: AppSection; label: string }> = [
  { id: "markets", label: "Markets" },
  { id: "portfolio", label: "Portfolio" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [section, setSection] = useState<AppSection>("markets");
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [hideBalances, setHideBalances] = useState(false);
  const panelOpen = usePanelLifecycle();
  const queryClient = useQueryClient();

  const addProfile = (profile: ProfileRecord) => {
    setProfiles((current) =>
      current.some((item) => item.id === profile.id) ? current : [...current, profile]
    );
    setSelectedProfileId(profile.id);
  };

  const renameProfile = (profileId: string, label: string) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === profileId ? { ...profile, label } : profile
      )
    );
  };

  const removeProfile = (profileId: string) => {
    setProfiles((current) => {
      const next = current.filter((profile) => profile.id !== profileId);
      setSelectedProfileId((selected) =>
        selected === profileId ? next[0]?.id : selected
      );
      return next;
    });
    queryClient.removeQueries({ queryKey: ["portfolio", profileId] });
  };

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

      {section === "markets" ? <MarketsView panelOpen={panelOpen} /> : null}
      {section === "portfolio" ? (
        <PortfolioView
          panelOpen={panelOpen}
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          hideBalances={hideBalances}
          onAddProfile={addProfile}
          onSelectProfile={setSelectedProfileId}
          onRenameProfile={renameProfile}
          onRemoveProfile={removeProfile}
          onTogglePrivacy={() => setHideBalances((hidden) => !hidden)}
        />
      ) : null}
      {section === "settings" ? (
        <section className="coming-soon" aria-live="polite">
          <p className="eyebrow">Next milestone</p>
          <h1>Preferences</h1>
          <p>Refresh cadence, local storage, and startup controls will live here.</p>
        </section>
      ) : null}
    </main>
  );
}

export interface ProfileRecord {
  id: string;
  label: string;
}
