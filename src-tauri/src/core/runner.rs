use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use tauri::{AppHandle, Emitter};

use serde::Serialize;

#[derive(Serialize, Clone)]
struct ProcessOutput {
    nanoid: String,
    stream: String, // "stdout" or "stderr"
    line: String,
}

#[tauri::command]
pub fn launch_minecraft(
    app: AppHandle,
    java_path: String,
    cwd: String,
    args: Vec<String>,
    nanoid: String,
) -> Result<(), String> {
    let mut child = Command::new(java_path)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    let nanoid_stdout = nanoid.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_stdout.emit(
                    "process-output",
                    ProcessOutput {
                        nanoid: nanoid_stdout.clone(),
                        stream: "stdout".into(),
                        line,
                    },
                );
            }
        }
    });

    let app_stderr = app.clone();
    let nanoid_stderr = nanoid.clone();

    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_stderr.emit(
                    "process-output",
                    ProcessOutput {
                        nanoid: nanoid_stderr.clone(),
                        stream: "stderr".into(),
                        line,
                    },
                );
            }
        }
    });

    Ok(())
}
