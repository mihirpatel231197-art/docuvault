use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct PythonBackend(Mutex<Option<Child>>);

fn start_python_backend() -> Option<Child> {
    let server_path = std::env::current_dir()
        .ok()?
        .parent()?
        .parent()?
        .join("desktop")
        .join("src-python")
        .join("server.py");

    let child = Command::new("python3")
        .arg(server_path.to_str()?)
        .arg("8200")
        .spawn()
        .ok()?;

    // Wait a moment for server to start
    std::thread::sleep(std::time::Duration::from_secs(2));
    Some(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend = start_python_backend();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PythonBackend(Mutex::new(backend)))
        .setup(|_app| {
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                // Kill Python backend on exit
                let state = app.state::<PythonBackend>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                    }
                }
            }
        });
}
