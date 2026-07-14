import { useEffect, useState } from "react";
import {
  type CompatibilityReport,
  runCompatibilitySpike,
} from "../liquidium/compatibility";

type SpikeState =
  | { status: "running" }
  | { status: "complete"; report: CompatibilityReport };

export function App() {
  const [state, setState] = useState<SpikeState>({ status: "running" });

  useEffect(() => {
    let active = true;
    runCompatibilitySpike().then((report) => {
      if (active) {
        setState({ status: "complete", report });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <h1>LiqWatch</h1>
          <p>Liquidium from your menu bar.</p>
        </div>
      </header>
      <section className="placeholder-panel" aria-live="polite">
        <p className="eyebrow">Compatibility spike</p>
        {state.status === "running" ? (
          <>
            <h2>Checking Liquidium in this WebView</h2>
            <p>Loading live markets and a read-only profile…</p>
          </>
        ) : (
          <CompatibilityResults report={state.report} />
        )}
      </section>
    </main>
  );
}

function CompatibilityResults({ report }: { report: CompatibilityReport }) {
  const runtimeReady = Object.values(report.runtime).every(Boolean);
  const ready = runtimeReady && report.markets.ok && report.portfolio.ok;

  return (
    <>
      <h2>{ready ? "Direct SDK access works" : "Compatibility needs attention"}</h2>
      <dl className="compatibility-list">
        <CompatibilityRow label="Tauri WebView" ready={report.runtime.tauri} />
        <CompatibilityRow label="Browser primitives" ready={runtimeReady} />
        <CompatibilityRow
          label="Live markets"
          ready={report.markets.ok}
          detail={
            report.markets.ok ? `${report.markets.count} markets` : report.markets.error
          }
        />
        <CompatibilityRow
          label="Profile positions"
          ready={report.portfolio.ok}
          detail={
            report.portfolio.ok
              ? `${report.portfolio.positionCount} positions on test profile`
              : report.portfolio.error
          }
        />
      </dl>
      <p className="compatibility-footnote">
        {ready
          ? "No backend or wallet runtime is required."
          : "The full interface will remain paused until this check is green."}
      </p>
    </>
  );
}

function CompatibilityRow({
  label,
  ready,
  detail,
}: {
  label: string;
  ready: boolean;
  detail?: string;
}) {
  return (
    <div className="compatibility-row">
      <dt>{label}</dt>
      <dd>
        <span className={ready ? "status-dot ready" : "status-dot"} />
        {detail ?? (ready ? "Ready" : "Unavailable")}
      </dd>
    </div>
  );
}
