import type { DisplayMode } from "./storage";

export function DisplayModeSwitcher({
  value,
  onChange,
}: {
  value: DisplayMode;
  onChange(value: DisplayMode): void;
}) {
  return (
    <fieldset className="display-mode-switcher">
      <legend className="sr-only">Display mode</legend>
      <button
        type="button"
        aria-pressed={value === "graphs"}
        onClick={() => onChange("graphs")}
      >
        Charts
      </button>
      <button
        type="button"
        aria-pressed={value === "numbers"}
        onClick={() => onChange("numbers")}
      >
        Details
      </button>
    </fieldset>
  );
}
