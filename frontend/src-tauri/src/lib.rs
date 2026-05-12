use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct PythonBackend(Mutex<Option<Child>>);

fn start_python_backend() -> Option<Child> {
    // Resolve server.py relative to the .app bundle's MacOS binary
    // .app/Contents/MacOS/docuvault -> up 3 dirs -> bundle root -> up -> target/release/bundle
    // For dev: find the repo root relative to the executable
    let exe = std::env::current_exe().ok()?;

    // Walk up from the binary to find desktop/src-python/server.py
    // Works both for direct cargo run and inside .app bundle
    let candidates = [
        // Inside .app bundle: .app/Contents/MacOS -> up 4 -> repo root
        exe.ancestors().nth(4).map(|p| p.join("desktop/src-python/server.py")),
        // Direct cargo run from frontend/src-tauri: up 3 -> repo root
        exe.ancestors().nth(3).map(|p| p.join("desktop/src-python/server.py")),
        // Absolute fallback for dev
        Some(std::path::PathBuf::from(
            std::env::var("HOME").unwrap_or_default() + "/Dev/docuvault/desktop/src-python/server.py"
        )),
    ];

    let server_path = candidates.into_iter().flatten().find(|p| p.exists())?;

    let child = Command::new("python3")
        .arg(&server_path)
        .spawn()
        .ok()?;

    // Wait for server to start
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
                let state = app.state::<PythonBackend>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                    }
                };
            }
        });
}
