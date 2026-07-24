import type { Update } from "@tauri-apps/plugin-updater";
import { describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  installUpdate,
  UPDATE_CHECK_TIMEOUT_MS,
  type UpdateInstallProgress,
} from "./updates";

describe("update availability", () => {
  it("returns an update from the signed Tauri endpoint", async () => {
    const update = { version: "0.1.6" } as Update;
    const request = vi.fn().mockResolvedValue(update);

    await expect(checkForUpdate(request)).resolves.toBe(update);
    expect(request).toHaveBeenCalledWith({ timeout: UPDATE_CHECK_TIMEOUT_MS });
  });

  it("returns undefined when the installed version is current", async () => {
    const request = vi.fn().mockResolvedValue(null);

    await expect(checkForUpdate(request)).resolves.toBeUndefined();
  });

  it("downloads, installs, and relaunches with progress", async () => {
    const progress: UpdateInstallProgress[] = [];
    const restart = vi.fn().mockResolvedValue(undefined);
    const downloadAndInstall = vi.fn().mockImplementation(async (onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 25 } });
      onEvent({ event: "Progress", data: { chunkLength: 75 } });
      onEvent({ event: "Finished" });
    });

    await installUpdate(
      { version: "0.1.6", downloadAndInstall },
      (event) => progress.push(event),
      restart
    );

    expect(progress).toEqual([
      { phase: "downloading", percentage: 0 },
      { phase: "downloading", percentage: 25 },
      { phase: "downloading", percentage: 100 },
      { phase: "installing" },
    ]);
    expect(restart).toHaveBeenCalledOnce();
  });

  it("does not relaunch when signature verification or installation fails", async () => {
    const restart = vi.fn();
    const failure = new Error("signature verification failed");
    const downloadAndInstall = vi.fn().mockRejectedValue(failure);

    await expect(
      installUpdate({ version: "0.1.6", downloadAndInstall }, vi.fn(), restart)
    ).rejects.toThrow(failure);
    expect(restart).not.toHaveBeenCalled();
  });
});
