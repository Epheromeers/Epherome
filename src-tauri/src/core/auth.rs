use tauri::{Emitter, Manager};

#[tauri::command]
pub async fn get_microsoft_auth_code(app: tauri::AppHandle) -> Result<(), String> {
    let link = "https://login.live.com/oauth20_authorize.srf\
                ?client_id=00000000402b5328\
                &response_type=code\
                &prompt=login\
                &scope=service%3A%3Auser.auth.xboxlive.com%3A%3AMBI_SSL\
                &redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf";
    let window =
        tauri::WebviewWindowBuilder::new(&app, "auth", tauri::WebviewUrl::App(link.into()))
            .title("Microsoft Authentication")
            .inner_size(768.0, 512.0)
            .on_page_load(|window, payload| {
                let prefix = "https://login.live.com/oauth20_desktop.srf?";
                let url = payload.url();
                if url.as_str().starts_with(prefix) {
                    let auth_code = url.query_pairs().find_map(|(key, value)| {
                        if key == "code" {
                            Some(value.into_owned())
                        } else {
                            None
                        }
                    });
                    let _ = window
                        .app_handle()
                        .emit("ms-auth-code", auth_code.unwrap_or_default());
                    let _ = window.close();
                }
            })
            .build()
            .map_err(|err| format!("Failed to open Microsoft authentication window: {}", err))?;
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            let _ = app.emit("ms-auth-code", "");
        }
    });
    Ok(())
}
