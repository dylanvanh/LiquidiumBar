import type { InstallableUpdate } from "./updates";

export type UpdateButtonStatus = "available" | "downloading" | "installing" | "error";

interface UpdateAvailableButtonProps {
  update: InstallableUpdate;
  status: UpdateButtonStatus;
  progress?: number;
  error?: string;
  onInstall(): void;
}

function buttonLabel(version: string, status: UpdateButtonStatus, progress?: number) {
  if (status === "downloading") {
    return progress === undefined ? "Downloading…" : `Downloading ${progress}%`;
  }
  if (status === "installing") return "Installing…";
  if (status === "error") return "Retry update";
  return `Update ${version}`;
}

export function UpdateAvailableButton({
  update,
  status,
  progress,
  error,
  onInstall,
}: UpdateAvailableButtonProps) {
  const busy = status === "downloading" || status === "installing";
  const label = buttonLabel(update.version, status, progress);

  return (
    <button
      type="button"
      className={`update-available-button ${status}`}
      aria-label={
        status === "available"
          ? `LiquidiumBar ${update.version} is available. Install update`
          : label
      }
      aria-live="polite"
      disabled={busy}
      title={error ?? `Install LiquidiumBar ${update.version}`}
      onClick={onInstall}
    >
      <span aria-hidden="true" className="update-available-dot" />
      {label}
    </button>
  );
}
