#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]

#[tauri::command]
fn get_omarchy_colors() -> Result<String, String> {
    let home = std::env::var_os("HOME")
        .ok_or_else(|| "HOME is not available".to_string())?;
    let path = std::path::PathBuf::from(home)
        .join(".local")
        .join("state")
        .join("omarchy")
        .join("current")
        .join("theme")
        .join("colors.toml");
    std::fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Omarchy colors at {}: {error}", path.display()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_omarchy_colors])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            _app.get_webview_window("main")
                .expect("main window should exist")
                .open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Pixel Forge");
}
