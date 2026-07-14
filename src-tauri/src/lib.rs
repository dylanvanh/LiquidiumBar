use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompatibilityLog {
    runtime_ready: bool,
    markets_ok: bool,
    market_count: usize,
    portfolio_ok: bool,
    position_count: usize,
    observed_origins: Vec<String>,
}

#[tauri::command]
fn log_compatibility(report: CompatibilityLog) {
    eprintln!(
        "LiqWatch compatibility: runtime_ready={} markets_ok={} market_count={} portfolio_ok={} position_count={} observed_origins={:?}",
        report.runtime_ready,
        report.markets_ok,
        report.market_count,
        report.portfolio_ok,
        report.position_count,
        report.observed_origins
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![log_compatibility])
        .run(tauri::generate_context!())
        .expect("error while running LiqWatch");
}
