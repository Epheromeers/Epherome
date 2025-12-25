use std::process::{Command};

#[tauri::command]
pub fn launch_minecraft(java_path: String, cwd: String, args: Vec<String>) -> Result<(), String> {
  Command::new(java_path)
    .args(args)
    .current_dir(cwd)
    .spawn()
    .map_err(|e| e.to_string())
    .map(|_| ())
}
