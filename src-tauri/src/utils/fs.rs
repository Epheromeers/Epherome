use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::fs;
use std::path::Path;

fn sha1_hex(content: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(content);
    hasher
        .finalize()
        .as_slice()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>()
}

/// Information about a directory entry
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCheckRequest {
    pub pathname: String,
    pub expected_sha1: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectRequest {
    pub pathname: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCheckResult {
    pub pathname: String,
    pub exists: bool,
    pub hash_matched: Option<bool>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectResult {
    pub pathname: String,
    pub exists: bool,
    pub size: Option<String>,
    pub modified_ms: Option<String>,
    pub error: Option<String>,
}

/// Read the contents of a text file
#[tauri::command]
pub async fn read_text_file(pathname: String) -> Result<String, String> {
    fs::read_to_string(&pathname).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write text content to a file
#[tauri::command]
pub async fn write_text_file(pathname: String, contents: String) -> Result<(), String> {
    fs::write(&pathname, contents).map_err(|e| format!("Failed to write file: {}", e))
}

/// Check if a file or directory exists
#[tauri::command]
pub async fn exists(pathname: String) -> Result<bool, String> {
    Ok(Path::new(&pathname).exists())
}

/// Create a directory and all parent directories
#[tauri::command]
pub async fn mkdir(pathname: String) -> Result<(), String> {
    fs::create_dir_all(&pathname).map_err(|e| format!("Failed to create directory: {}", e))
}

/// Read directory contents and return detailed information about each entry
#[tauri::command]
pub async fn read_dir(pathname: String) -> Result<Vec<DirEntry>, String> {
    let entries =
        fs::read_dir(&pathname).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        if let Some(name) = entry.file_name().to_str() {
            let metadata = entry
                .metadata()
                .map_err(|e| format!("Failed to read metadata: {}", e))?;

            result.push(DirEntry {
                name: name.to_string(),
                is_directory: metadata.is_dir(),
                is_file: metadata.is_file(),
            });
        }
    }

    Ok(result)
}

/// Read the contents of a file as a byte array
#[tauri::command]
pub async fn read_file(pathname: String) -> Result<Vec<u8>, String> {
    fs::read(&pathname).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write byte array content to a file
#[tauri::command]
pub async fn write_file(pathname: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&pathname, contents).map_err(|e| format!("Failed to write file: {}", e))
}

/// Compute SHA-1 hash for a file
#[tauri::command]
pub async fn sha1_file(pathname: String) -> Result<String, String> {
    let content = fs::read(&pathname).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(sha1_hex(&content))
}

#[tauri::command]
pub async fn check_files(requests: Vec<FileCheckRequest>) -> Result<Vec<FileCheckResult>, String> {
    let mut results = Vec::with_capacity(requests.len());

    for request in requests {
        let file_exists = Path::new(&request.pathname).exists();
        let mut hash_matched = None;
        let mut error = None;

        if file_exists {
            if let Some(expected_sha1) = request.expected_sha1 {
                match fs::read(&request.pathname) {
                    Ok(content) => {
                        let actual = sha1_hex(&content);
                        hash_matched = Some(actual == expected_sha1);
                    }
                    Err(e) => {
                        error = Some(format!("Failed to read file: {}", e));
                    }
                }
            }
        }

        results.push(FileCheckResult {
            pathname: request.pathname,
            exists: file_exists,
            hash_matched,
            error,
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn inspect_files(
    requests: Vec<FileInspectRequest>,
) -> Result<Vec<FileInspectResult>, String> {
    let mut results = Vec::with_capacity(requests.len());

    for request in requests {
        match fs::metadata(&request.pathname) {
            Ok(metadata) => {
                let modified_ms = metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis().to_string());
                results.push(FileInspectResult {
                    pathname: request.pathname,
                    exists: true,
                    size: Some(metadata.len().to_string()),
                    modified_ms,
                    error: None,
                });
            }
            Err(e) => {
                if Path::new(&request.pathname).exists() {
                    results.push(FileInspectResult {
                        pathname: request.pathname,
                        exists: true,
                        size: None,
                        modified_ms: None,
                        error: Some(format!("Failed to read file metadata: {}", e)),
                    });
                } else {
                    results.push(FileInspectResult {
                        pathname: request.pathname,
                        exists: false,
                        size: None,
                        modified_ms: None,
                        error: None,
                    });
                }
            }
        }
    }

    Ok(results)
}
