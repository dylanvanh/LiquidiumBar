import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { truncateProfile } from "./format";
import type { ProfileRecord, RefreshIntervalSeconds } from "./storage";
import { REFRESH_INTERVALS } from "./storage";

interface SettingsViewProps {
  refreshIntervalSeconds: RefreshIntervalSeconds;
  profiles: ProfileRecord[];
  onRefreshIntervalChange(value: RefreshIntervalSeconds): void;
  onSelectProfile(profileId: string): void;
  onRemoveProfile(profileId: string): void;
}

export function SettingsView({
  refreshIntervalSeconds,
  profiles,
  onRefreshIntervalChange,
  onSelectProfile,
  onRemoveProfile,
}: SettingsViewProps) {
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [autostartReady, setAutostartReady] = useState(!isTauri());
  const [autostartError, setAutostartError] = useState<string>();

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void isEnabled()
      .then((enabled) => {
        if (active) setOpenAtLogin(enabled);
      })
      .catch(() => {
        if (active) setAutostartError("Open at Login status is unavailable.");
      })
      .finally(() => {
        if (active) setAutostartReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleAutostart = async () => {
    const next = !openAtLogin;
    setAutostartReady(false);
    setAutostartError(undefined);
    try {
      if (next) await enable();
      else await disable();
      setOpenAtLogin(await isEnabled());
    } catch {
      setAutostartError("Open at Login could not be changed.");
    } finally {
      setAutostartReady(true);
    }
  };

  return (
    <section className="view settings-view" aria-labelledby="settings-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Local preferences</p>
          <h1 id="settings-title">Settings</h1>
        </div>
      </div>

      <SettingsGroup title="General">
        <SettingRow
          label="Open at Login"
          description="Starts LiqWatch as a menu-bar accessory."
        >
          <button
            type="button"
            role="switch"
            aria-checked={openAtLogin}
            className={openAtLogin ? "switch active" : "switch"}
            disabled={!autostartReady || !isTauri()}
            onClick={() => void toggleAutostart()}
          >
            <span />
          </button>
        </SettingRow>
        {autostartError ? (
          <p className="setting-error" role="alert">
            {autostartError}
          </p>
        ) : null}
        <SettingRow
          label="Refresh interval"
          description="Polling runs only while the panel is open."
        >
          <select
            aria-label="Refresh interval"
            value={refreshIntervalSeconds}
            onChange={(event) =>
              onRefreshIntervalChange(
                Number(event.target.value) as RefreshIntervalSeconds
              )
            }
          >
            {REFRESH_INTERVALS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Profiles">
        {profiles.length ? (
          profiles.map((profile) => (
            <div className="settings-profile" key={profile.id}>
              <button
                type="button"
                className="profile-link"
                onClick={() => onSelectProfile(profile.id)}
              >
                <strong>{profile.label}</strong>
                <span className="mono-text">{truncateProfile(profile.id)}</span>
              </button>
              <button
                type="button"
                className="settings-icon-button"
                aria-label={`Copy ${profile.label} principal`}
                onClick={() => void navigator.clipboard.writeText(profile.id)}
              >
                ⧉
              </button>
              <button
                type="button"
                className="settings-icon-button danger-text"
                aria-label={`Remove ${profile.label}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remove ${profile.label} and its cached portfolio data?`
                    )
                  )
                    onRemoveProfile(profile.id);
                }}
              >
                −
              </button>
            </div>
          ))
        ) : (
          <p className="settings-empty">No saved profiles.</p>
        )}
      </SettingsGroup>

      <SettingsGroup title="Data & privacy">
        <p className="disclosure-copy">
          Live read-only market and public profile data comes directly from Liquidium
          through <span className="mono-text">icp-api.io</span>. Settings and versioned
          snapshots stay in Tauri’s private app-data store on this Mac. No wallet,
          backend, analytics, or telemetry is used.
        </p>
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingRow
          label="LiqWatch"
          description="Unofficial Liquidium monitoring client."
        >
          <span className="setting-value">0.1.0</span>
        </SettingRow>
        <SettingRow label="Liquidium SDK" description="Pinned read adapter.">
          <span className="setting-value mono-text">0.5.0-rc.1</span>
        </SettingRow>
        <ExternalLink label="Liquidium website" url="https://liquidium.fi/" />
        <ExternalLink
          label="SDK source"
          url="https://github.com/Liquidium-Inc/liquidium-sdk"
        />
      </SettingsGroup>

      <p className="unofficial-note">
        LiqWatch is an unofficial, read-only product and is not endorsed by Liquidium.
      </p>
    </section>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      {children}
    </div>
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  const open = () => {
    if (isTauri()) void openUrl(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <button type="button" className="external-link" onClick={open}>
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </button>
  );
}
