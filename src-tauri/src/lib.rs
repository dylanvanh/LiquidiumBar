use serde::Deserialize;
use tauri::{
    Emitter, Manager,
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_positioner::{Position, WindowExt};

const MAIN_WINDOW_LABEL: &str = "main";
const MENU_OPEN_ID: &str = "open";
const MENU_QUIT_ID: &str = "quit";

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PanelAction {
    Show,
    Hide,
}

fn panel_action(is_visible: bool) -> PanelAction {
    if is_visible {
        PanelAction::Hide
    } else {
        PanelAction::Show
    }
}

fn log_compatibility_report(report: &CompatibilityLog) {
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

#[tauri::command]
fn log_compatibility(report: CompatibilityLog) {
    log_compatibility_report(&report);
}

fn hide_panel(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window.hide()?;
        let _ = window.emit("panel-closed", ());
    }
    Ok(())
}

fn show_panel(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        window.move_window_constrained(Position::TrayCenter)?;
        window.show()?;
        window.set_focus()?;
        window.emit("panel-opened", ())?;
    }
    Ok(())
}

fn toggle_panel(app: &tauri::AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };

    match panel_action(window.is_visible()?) {
        PanelAction::Show => show_panel(app),
        PanelAction::Hide => hide_panel(app),
    }
}

fn configure_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN_ID, "Open LiqWatch", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT_ID, "Quit LiqWatch", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let tray_icon = Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;

    TrayIconBuilder::with_id("liqwatch")
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("LiqWatch")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_OPEN_ID => {
                let _ = show_panel(app);
            }
            MENU_QUIT_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                let _ = toggle_panel(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![log_compatibility])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            configure_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == MAIN_WINDOW_LABEL
                && matches!(event, tauri::WindowEvent::Focused(false))
            {
                let _ = window.hide();
                let _ = window.emit("panel-closed", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LiqWatch");
}

#[cfg(test)]
mod tests {
    use super::{PanelAction, panel_action};

    #[test]
    fn tray_click_shows_a_hidden_panel() {
        assert_eq!(panel_action(false), PanelAction::Show);
    }

    #[test]
    fn tray_click_hides_a_visible_panel() {
        assert_eq!(panel_action(true), PanelAction::Hide);
    }
}
