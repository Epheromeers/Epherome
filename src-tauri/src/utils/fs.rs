use std::fs;
use std::path::Path;

/// Read the contents of a text file
#[tauri::command]
pub fn read_text_file(pathname: String) -> Result<String, String> {
    fs::read_to_string(&pathname).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write text content to a file
#[tauri::command]
pub fn write_text_file(pathname: String, contents: String) -> Result<(), String> {
    fs::write(&pathname, contents).map_err(|e| format!("Failed to write file: {}", e))
}

/// Check if a file or directory exists
#[tauri::command]
pub fn exists(pathname: String) -> Result<bool, String> {
    Ok(Path::new(&pathname).exists())
}

/// Create a directory and all parent directories
#[tauri::command]
pub fn mkdir(pathname: String) -> Result<(), String> {
    fs::create_dir_all(&pathname).map_err(|e| format!("Failed to create directory: {}", e))
}

/// Read directory contents and return list of file/folder names
#[tauri::command]
pub fn read_dir(pathname: String) -> Result<Vec<String>, String> {
    let entries =
        fs::read_dir(&pathname).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        if let Some(name) = entry.file_name().to_str() {
            result.push(name.to_string());
        }
    }

    Ok(result)
}

/// Read the contents of a file as a byte array
#[tauri::command]
pub fn read_file(pathname: String) -> Result<Vec<u8>, String> {
    fs::read(&pathname).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write byte array content to a file
#[tauri::command]
pub fn write_file(pathname: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&pathname, contents).map_err(|e| format!("Failed to write file: {}", e))
}
