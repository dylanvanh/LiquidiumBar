export function App() {
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
      <section className="placeholder-panel" aria-labelledby="setup-title">
        <p className="eyebrow">Desktop foundation</p>
        <h2 id="setup-title">Preparing live market monitoring</h2>
        <p>The Liquidium adapter and native menu-bar shell are next.</p>
      </section>
    </main>
  );
}
