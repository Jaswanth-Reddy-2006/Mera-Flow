use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use enigo::{Enigo, KeyboardControllable, Key};

#[tauri::command]
fn paste_transcript() {
    let mut enigo = Enigo::new();
    // Simulate Ctrl + V
    enigo.key_down(Key::Control);
    enigo.key_click(Key::Layout('v'));
    enigo.key_up(Key::Control);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, shortcut, event| {
            let ptt_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            let paste_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::ALT), Code::KeyV);

            if shortcut == &ptt_shortcut {
                if event.state() == ShortcutState::Pressed {
                    let _ = app.emit("shortcut-pressed", ());
                } else if event.state() == ShortcutState::Released {
                    let _ = app.emit("shortcut-released", ());
                }
            } else if shortcut == &paste_shortcut {
                if event.state() == ShortcutState::Pressed {
                    let _ = app.emit("shortcut-paste", ());
                }
            }
        }).build())
        .invoke_handler(tauri::generate_handler![paste_transcript])
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Register global shortcuts
            let ptt_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            let paste_shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::ALT), Code::KeyV);
            let _ = app.global_shortcut().register(ptt_shortcut);
            let _ = app.global_shortcut().register(paste_shortcut);

            if let Some(widget_window) = app.get_webview_window("widget") {
                if let Ok(Some(monitor)) = widget_window.current_monitor() {
                    let size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    if let Ok(window_size) = widget_window.outer_size() {
                        let x = (size.width as f64 - window_size.width as f64) / 2.0;
                        let y = size.height as f64 - window_size.height as f64 - (110.0 * scale_factor);
                        let _ = widget_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { 
                            x: x as i32, 
                            y: y as i32 
                        }));
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
