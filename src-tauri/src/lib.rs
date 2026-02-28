mod core;
mod utils;

use core::auth::get_microsoft_auth_code;
use core::java::{detect_java_runtimes, get_java_version};
use core::runner::launch_minecraft;
use utils::fs::{exists, mkdir, read_dir, read_file, read_text_file, write_file, write_text_file};
use utils::http::fetch;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            launch_minecraft,
            get_microsoft_auth_code,
            get_java_version,
            detect_java_runtimes,
            read_text_file,
            write_text_file,
            read_file,
            write_file,
            exists,
            mkdir,
            read_dir,
            fetch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
