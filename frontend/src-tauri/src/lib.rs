use std::net::TcpStream;
use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct PythonBackend(Mutex<Option<Child>>);

fn port_is_listening(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

fn start_python_backend() -> Option<Child> {
    // If something is already on 8200, reuse it (e.g. dev server or previous launch)
    if port_is_listening(8200) {
        return None;
    }

    let exe = std::env::current_exe().ok()?;

    let candidates = [
        exe.ancestors().nth(5).map(|p| p.join("desktop/src-python/server.py")),
        exe.ancestors().nth(4).map(|p| p.join("desktop/src-python/server.py")),
        exe.ancestors().nth(3).map(|p| p.join("desktop/src-python/server.py")),
        Some(std::path::PathBuf::from(
            std::env::var("HOME").unwrap_or_default() + "/Dev/docuvault/desktop/src-python/server.py"
        )),
    ];

    let server_path = candidates.into_iter().flatten().find(|p| p.exists())?;

    let child = Command::new("python3")
        .arg(&server_path)
        .arg("8200")
        .spawn()
        .ok()?;

    // Poll until the server is ready (up to 15 seconds)
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if port_is_listening(8200) {
            break;
        }
    }

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
