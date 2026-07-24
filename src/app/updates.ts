import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import packageMetadata from "../../package.json";

export const CURRENT_VERSION = packageMetadata.version;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const UPDATE_CHECK_TIMEOUT_MS = 15_000;

export type InstallableUpdate = Pick<
  Update,
  "body" | "date" | "downloadAndInstall" | "version"
>;

export type UpdateInstallProgress =
  | { phase: "downloading"; percentage?: number }
  | { phase: "installing" };

export async function checkForUpdate(
  request: typeof check = check
): Promise<Update | undefined> {
  return (await request({ timeout: UPDATE_CHECK_TIMEOUT_MS })) ?? undefined;
}

export async function installUpdate(
  update: InstallableUpdate,
  onProgress: (progress: UpdateInstallProgress) => void,
  restart: typeof relaunch = relaunch
): Promise<void> {
  let downloadedBytes = 0;
  let contentLength: number | undefined;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      contentLength = event.data.contentLength;
      onProgress({
        phase: "downloading",
        percentage: contentLength ? 0 : undefined,
      });
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
      onProgress({
        phase: "downloading",
        percentage: contentLength
          ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
          : undefined,
      });
      return;
    }

    onProgress({ phase: "installing" });
  });

  await restart();
}
