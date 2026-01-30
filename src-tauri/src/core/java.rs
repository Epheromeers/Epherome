use regex::Regex;
use std::process::Command;

#[tauri::command]
pub fn get_java_version(java_path: String) -> Result<String, String> {
    let output = Command::new(&java_path)
        .arg("-version")
        .output()
        .map_err(|e| format!("Failed to execute java: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if output.status.success() {
        let combined = format!("{}{}", stdout, stderr);

        // Try to extract version number using regex
        if let Ok(re) = Regex::new(r#"version\s+"?([^\s"]+)"?"#) {
            if let Some(caps) = re.captures(&combined) {
                if let Some(version) = caps.get(1) {
                    return Ok(version.as_str().to_string());
                }
            }
        }

        // Fallback: return the first line if regex fails
        Ok(combined.lines().next().unwrap_or("unknown").to_string())
    } else {
        let error_msg = if !stderr.is_empty() {
            stderr.to_string()
        } else {
            stdout.to_string()
        };
        Err(if error_msg.is_empty() {
            "Java command failed with no output".to_string()
        } else {
            error_msg.trim().to_string()
        })
    }
}
