use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    Emitter, Manager,
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_positioner::{Position, WindowExt};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "liqwatch";
const MENU_OPEN_ID: &str = "open";
const MENU_QUIT_ID: &str = "quit";

#[derive(Default)]
struct PanelState {
    focused_after_show: AtomicBool,
}

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

fn validate_tray_title(title: &str) -> Result<&str, &'static str> {
    let title = title.trim();
    if title.is_empty() {
        return Err("tray title cannot be empty");
    }
    if title.chars().count() > 24 || title.chars().any(char::is_control) {
        return Err("tray title is invalid");
    }
    Ok(title)
}

#[tauri::command]
fn set_tray_market_title(app: tauri::AppHandle, title: String) -> Result<(), String> {
    let title = validate_tray_title(&title).map_err(str::to_owned)?;
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "LiqWatch tray icon is unavailable".to_owned())?;
    tray.set_title(Some(title))
        .map_err(|error| error.to_string())?;
    tray.set_tooltip(Some(format!("LiqWatch · {title}")))
        .map_err(|error| error.to_string())
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
        app.state::<PanelState>()
            .focused_after_show
            .store(false, Ordering::Release);
        // Positioning can fail transiently while displays or full-screen spaces change.
        // Showing the panel is more important than perfect placement in that one frame.
        let _ = window.move_window_constrained(Position::TrayCenter);
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

    TrayIconBuilder::with_id(TRAY_ID)
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
        .manage(PanelState::default())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            log_compatibility,
            set_tray_market_title
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            configure_tray(app)?;
            #[cfg(debug_assertions)]
            if std::env::var_os("LIQWATCH_OPEN_PANEL").is_some() {
                show_panel(app.handle())?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }
            let state = window.state::<PanelState>();
            match event {
                tauri::WindowEvent::Focused(true) => {
                    state.focused_after_show.store(true, Ordering::Release);
                }
                tauri::WindowEvent::Focused(false)
                    if state.focused_after_show.swap(false, Ordering::AcqRel) =>
                {
                    let _ = window.hide();
                    let _ = window.emit("panel-closed", ());
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LiqWatch");
}

#[cfg(test)]
mod tests {
    use super::{PanelAction, panel_action, validate_tray_title};

    #[test]
    fn tray_click_shows_a_hidden_panel() {
        assert_eq!(panel_action(false), PanelAction::Show);
    }

    #[test]
    fn tray_click_hides_a_visible_panel() {
        assert_eq!(panel_action(true), PanelAction::Hide);
    }

    #[test]
    fn tray_titles_are_short_and_single_line() {
        assert_eq!(validate_tray_title(" $803.1K "), Ok("$803.1K"));
        assert!(validate_tray_title("").is_err());
        assert!(validate_tray_title("$803K\nborrowed").is_err());
        assert!(validate_tray_title("a title that is far too long for the menu bar").is_err());
    }
}
