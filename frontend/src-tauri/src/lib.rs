use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

// Handle to the child FastAPI process so we can kill it on shutdown.
struct BackendProcess(Mutex<Option<Child>>);

fn spawn_backend(
    app: &tauri::AppHandle,
) -> Result<Option<Child>, Box<dyn std::error::Error>> {
    // In the bundled app, PyInstaller's onedir output lives under
    // resource_dir/binaries/backend/. Bundle.resources in tauri.conf.json
    // preserves the path prefix relative to src-tauri/ when copying.
    let resource_dir = app.path().resource_dir()?;
    let backend_exe = resource_dir
        .join("binaries")
        .join("backend")
        .join("eagle-backend");

    if !backend_exe.exists() {
        return Ok(None);
    }

    let child = Command::new(&backend_exe)
        .current_dir(backend_exe.parent().unwrap())
        .spawn()
        .map_err(|e| format!("failed to spawn backend at {:?}: {}", backend_exe, e))?;

    log::info!("spawned eagle-backend pid={}", child.id());
    Ok(Some(child))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn the backend if the bundled binary is present. During
            // `tauri dev` (no bundle) this is a no-op and the developer runs
            // uvicorn themselves with `uv run python main.py --dev`.
            match spawn_backend(app.handle()) {
                Ok(Some(child)) => {
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(child);
                }
                Ok(None) => {
                    log::info!("no bundled backend found — assuming dev server on :52777");
                }
                Err(e) => {
                    log::error!("failed to start backend: {}", e);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Kill the backend on exit so it does not outlive the window.
            if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<BackendProcess>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                        let _ = child.wait();
                        log::info!("killed eagle-backend");
                    }
                }
            }
        });
}
