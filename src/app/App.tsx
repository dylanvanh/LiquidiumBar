import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InsightsView } from "./InsightsView";
import { MarketsView } from "./MarketsView";
import { PortfolioView } from "./PortfolioView";
import { SettingsView } from "./SettingsView";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  deletePortfolioSnapshot,
  hydrateSnapshots,
  loadSettings,
  type ProfileRecord,
  type RefreshIntervalSeconds,
  saveSettings,
} from "./storage";
import { usePanelLifecycle } from "./usePanelLifecycle";

const sections: ReadonlyArray<{ id: AppSettings["section"]; label: string }> = [
  { id: "markets", label: "Markets" },
  { id: "insights", label: "Insights" },
  { id: "portfolio", label: "Portfolio" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const panelOpen = usePanelLifecycle();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    void loadSettings()
      .then(async (storedSettings) => {
        await hydrateSnapshots(queryClient, storedSettings.profiles);
        if (active) setSettings(storedSettings);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [queryClient]);

  useEffect(() => {
    if (ready) void saveSettings(settings).catch(() => undefined);
  }, [ready, settings]);

  if (!ready) {
    return (
      <section className="app-bootstrap" aria-label="Loading LiqWatch">
        <span />
      </section>
    );
  }

  const update = (patch: Partial<AppSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  const addProfile = (profile: ProfileRecord) => {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.some((item) => item.id === profile.id)
        ? current.profiles
        : [...current.profiles, profile],
      selectedProfileId: profile.id,
    }));
  };

  const renameProfile = (profileId: string, label: string) => {
    setSettings((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, label } : profile
      ),
    }));
  };

  const removeProfile = (profileId: string) => {
    setSettings((current) => {
      const profiles = current.profiles.filter((profile) => profile.id !== profileId);
      return {
        ...current,
        profiles,
        selectedProfileId:
          current.selectedProfileId === profileId
            ? profiles[0]?.id
            : current.selectedProfileId,
      };
    });
    queryClient.removeQueries({ queryKey: ["portfolio", profileId] });
    void deletePortfolioSnapshot(profileId).catch(() => undefined);
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
            className={settings.section === id ? "section-tab active" : "section-tab"}
            aria-current={settings.section === id ? "page" : undefined}
            onClick={() => update({ section: id })}
          >
            {label}
          </button>
        ))}
      </nav>

      {settings.section === "markets" ? (
        <MarketsView
          panelOpen={panelOpen}
          refreshIntervalSeconds={settings.refreshIntervalSeconds}
          displayMode={settings.displayMode}
          onDisplayModeChange={(displayMode) => update({ displayMode })}
        />
      ) : null}
      {settings.section === "insights" ? (
        <InsightsView
          panelOpen={panelOpen}
          refreshIntervalSeconds={settings.refreshIntervalSeconds}
        />
      ) : null}
      {settings.section === "portfolio" ? (
        <PortfolioView
          panelOpen={panelOpen}
          refreshIntervalSeconds={settings.refreshIntervalSeconds}
          profiles={settings.profiles}
          selectedProfileId={settings.selectedProfileId}
          hideBalances={settings.hideBalances}
          displayMode={settings.displayMode}
          onAddProfile={addProfile}
          onSelectProfile={(selectedProfileId) => update({ selectedProfileId })}
          onRenameProfile={renameProfile}
          onRemoveProfile={removeProfile}
          onTogglePrivacy={() => update({ hideBalances: !settings.hideBalances })}
          onDisplayModeChange={(displayMode) => update({ displayMode })}
        />
      ) : null}
      {settings.section === "settings" ? (
        <SettingsView
          refreshIntervalSeconds={settings.refreshIntervalSeconds}
          profiles={settings.profiles}
          onRefreshIntervalChange={(refreshIntervalSeconds: RefreshIntervalSeconds) =>
            update({ refreshIntervalSeconds })
          }
          onSelectProfile={(selectedProfileId) =>
            update({ selectedProfileId, section: "portfolio" })
          }
          onRemoveProfile={removeProfile}
        />
      ) : null}
    </main>
  );
}
