use tauri::{Emitter, Manager};

#[tauri::command]
pub fn get_microsoft_auth_code(app: tauri::AppHandle) -> Result<(), String> {
  let link = "https://login.live.com/oauth20_authorize.srf\
                ?client_id=00000000402b5328\
                &response_type=code\
                &prompt=login\
                &scope=service%3A%3Auser.auth.xboxlive.com%3A%3AMBI_SSL\
                &redirect_uri=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf";
  let window = tauri
    ::WebviewWindowBuilder
    ::new(&app, "auth", tauri::WebviewUrl::App(link.into()))
    .title("Microsoft Authentication")
    .inner_size(768.0, 512.0)
    .on_page_load(|window, payload| {
      let url = payload.url().to_string();
      let prefix = "https://login.live.com/oauth20_desktop.srf?";
      if url.starts_with(prefix) {
        let url = url.replace(prefix, "");
        let params = url.split("&").collect::<Vec<&str>>();
        for param in params {
          let pair = param.split("=").collect::<Vec<&str>>();
          if pair[0] == "code" {
            window.close().unwrap();
            window.app_handle().emit("ms-auth-code", pair[1]).unwrap();
            break;
          }
        }
      }
    })
    .build()
    .unwrap();
  window.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested {..} = event {
      app.emit("ms-auth-code", "").unwrap()
    }
  });
  Ok(())
}
