import type { QueryClient } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import { validateProfileId } from "../liquidium/profile";
import type { MarketSnapshot, NormalizedPortfolio } from "../liquidium/sdk.types";

export const SETTINGS_VERSION = 1;
export const REFRESH_INTERVALS = [30, 60, 120, 300] as const;
export type RefreshIntervalSeconds = (typeof REFRESH_INTERVALS)[number];
export type AppSection = "markets" | "insights" | "portfolio" | "settings";
export type DisplayMode = "graphs" | "numbers";
export type MenuBarMetric = "supplied" | "borrowed" | "available";

export interface ProfileRecord {
  id: string;
  label: string;
}

export interface AppSettings {
  version: typeof SETTINGS_VERSION;
  section: AppSection;
  profiles: ProfileRecord[];
  selectedProfileId?: string;
  hideBalances: boolean;
  displayMode: DisplayMode;
  menuBarMetric: MenuBarMetric;
  refreshIntervalSeconds: RefreshIntervalSeconds;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  section: "markets",
  profiles: [],
  hideBalances: false,
  displayMode: "graphs",
  menuBarMetric: "borrowed",
  refreshIntervalSeconds: 60,
};

const STORE_PATH = "liqwatch.v1.json";
const SETTINGS_KEY = "settings";
const MARKET_SNAPSHOT_KEY = "snapshot:markets";
const PORTFOLIO_SNAPSHOT_PREFIX = "snapshot:portfolio:";
const BIGINT_TAG = "__liqwatch_bigint__";
let storePromise: Promise<Store> | undefined;

export function serializeWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? { [BIGINT_TAG]: item.toString() } : item
  );
}

export function deserializeWithBigInt<T>(value: string): T {
  return JSON.parse(value, (_key, item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      Object.keys(item).length === 1 &&
      typeof item[BIGINT_TAG] === "string" &&
      /^-?\d+$/.test(item[BIGINT_TAG])
    ) {
      return BigInt(item[BIGINT_TAG]);
    }
    return item;
  }) as T;
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await readValue(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return normalizeSettings(deserializeWithBigInt<unknown>(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeValue(SETTINGS_KEY, serializeWithBigInt(settings));
}

export async function saveMarketSnapshot(snapshot: MarketSnapshot): Promise<void> {
  await writeValue(
    MARKET_SNAPSHOT_KEY,
    serializeWithBigInt({ version: SETTINGS_VERSION, kind: "markets", data: snapshot })
  );
}

export async function savePortfolioSnapshot(
  profileId: string,
  snapshot: NormalizedPortfolio
): Promise<void> {
  await writeValue(
    portfolioSnapshotKey(profileId),
    serializeWithBigInt({
      version: SETTINGS_VERSION,
      kind: "portfolio",
      data: snapshot,
    })
  );
}

export async function deletePortfolioSnapshot(profileId: string): Promise<void> {
  await deleteValue(portfolioSnapshotKey(profileId));
}

export async function hydrateSnapshots(
  queryClient: QueryClient,
  profiles: readonly ProfileRecord[]
): Promise<void> {
  const marketRaw = await readValue(MARKET_SNAPSHOT_KEY);
  if (marketRaw) {
    try {
      const stored = deserializeWithBigInt<StoredSnapshot<MarketSnapshot>>(marketRaw);
      if (stored.version === SETTINGS_VERSION && stored.kind === "markets") {
        const snapshot = stored.data;
        queryClient.setQueryData(["markets"], snapshot, {
          updatedAt: Date.parse(snapshot.fetchedAt),
        });
      }
    } catch {
      // A corrupt or previous-version snapshot is ignored safely.
    }
  }

  await Promise.all(
    profiles.map(async ({ id }) => {
      const raw = await readValue(portfolioSnapshotKey(id));
      if (!raw) return;
      try {
        const stored = deserializeWithBigInt<StoredSnapshot<NormalizedPortfolio>>(raw);
        if (stored.version !== SETTINGS_VERSION || stored.kind !== "portfolio") return;
        const snapshot = stored.data;
        if (snapshot.profileId !== id) return;
        queryClient.setQueryData(["portfolio", id], snapshot, {
          updatedAt: Date.parse(snapshot.fetchedAt),
        });
      } catch {
        // A corrupt or previous-version snapshot is ignored safely.
      }
    })
  );
}

export function isSnapshotStale(
  fetchedAt: string,
  staleTimeMs = 30_000,
  nowMs = Date.now()
): boolean {
  const fetchedAtMs = Date.parse(fetchedAt);
  return !Number.isFinite(fetchedAtMs) || nowMs - fetchedAtMs >= staleTimeMs;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value) || value.version !== SETTINGS_VERSION) return DEFAULT_SETTINGS;
  const profiles = Array.isArray(value.profiles)
    ? value.profiles.flatMap((item) => {
        if (
          !isRecord(item) ||
          typeof item.id !== "string" ||
          typeof item.label !== "string"
        ) {
          return [];
        }
        const validation = validateProfileId(item.id);
        return validation.ok
          ? [
              {
                id: validation.profileId,
                label: item.label.trim().slice(0, 40) || "Profile",
              },
            ]
          : [];
      })
    : [];
  const selectedProfileId =
    typeof value.selectedProfileId === "string" &&
    profiles.some(({ id }) => id === value.selectedProfileId)
      ? value.selectedProfileId
      : profiles[0]?.id;
  const refreshIntervalSeconds = REFRESH_INTERVALS.includes(
    value.refreshIntervalSeconds as RefreshIntervalSeconds
  )
    ? (value.refreshIntervalSeconds as RefreshIntervalSeconds)
    : DEFAULT_SETTINGS.refreshIntervalSeconds;
  const section =
    value.section === "markets" ||
    value.section === "insights" ||
    value.section === "portfolio" ||
    value.section === "settings"
      ? value.section
      : DEFAULT_SETTINGS.section;
  const displayMode = value.displayMode === "numbers" ? "numbers" : "graphs";
  const menuBarMetric: MenuBarMetric =
    value.menuBarMetric === "supplied" || value.menuBarMetric === "available"
      ? value.menuBarMetric
      : "borrowed";

  return {
    version: SETTINGS_VERSION,
    section,
    profiles,
    selectedProfileId,
    hideBalances: value.hideBalances === true,
    displayMode,
    menuBarMetric,
    refreshIntervalSeconds,
  };
}

function portfolioSnapshotKey(profileId: string): string {
  return `${PORTFOLIO_SNAPSHOT_PREFIX}${profileId}`;
}

async function getStore(): Promise<Store> {
  storePromise ??= load(STORE_PATH, { defaults: {}, autoSave: false });
  return storePromise;
}

async function readValue(key: string): Promise<string | undefined> {
  if (!isTauri()) return window.localStorage.getItem(key) ?? undefined;
  return (await getStore()).get<string>(key);
}

async function writeValue(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    window.localStorage.setItem(key, value);
    return;
  }
  const store = await getStore();
  await store.set(key, value);
  await store.save();
}

async function deleteValue(key: string): Promise<void> {
  if (!isTauri()) {
    window.localStorage.removeItem(key);
    return;
  }
  const store = await getStore();
  await store.delete(key);
  await store.save();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface StoredSnapshot<T> {
  version: number;
  kind: "markets" | "portfolio";
  data: T;
}
