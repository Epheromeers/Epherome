use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::{env, fs};

#[tauri::command]
pub async fn get_java_version(java_path: String) -> Result<String, String> {
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedJava {
    pub pathname: String,
    pub version: String,
    pub vendor: String,
}

/// Parse result from `java -version` output.
struct JavaInfo {
    version: String,
    vendor: String,
}

/// Known vendor identifiers mapped from the first line of `java -version` output.
fn detect_vendor(first_line: &str) -> String {
    let lower = first_line.to_lowercase();
    if lower.contains("graalvm") {
        "GraalVM".to_string()
    } else if lower.contains("corretto") {
        "Amazon Corretto".to_string()
    } else if lower.contains("temurin") || lower.contains("adoptium") {
        "Eclipse Temurin".to_string()
    } else if lower.contains("adoptopenjdk") {
        "AdoptOpenJDK".to_string()
    } else if lower.contains("zulu") {
        "Azul Zulu".to_string()
    } else if lower.contains("semeru") {
        "IBM Semeru".to_string()
    } else if lower.contains("liberica") {
        "BellSoft Liberica".to_string()
    } else if lower.contains("sapmachine") {
        "SapMachine".to_string()
    } else if lower.contains("microsoft") {
        "Microsoft OpenJDK".to_string()
    } else if lower.contains("openjdk") {
        "OpenJDK".to_string()
    } else if lower.contains("java") {
        "Oracle Java".to_string()
    } else {
        "Java".to_string()
    }
}

/// Extract version string and vendor from `java -version` output, returns None on failure.
fn try_get_java_info(java_path: &str) -> Option<JavaInfo> {
    let output = Command::new(java_path).arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let re = Regex::new(r#"version\s+"?([^\s"]+)"?"#).ok()?;
    let caps = re.captures(&combined)?;
    let version = caps.get(1)?.as_str().to_string();
    let first_line = combined.lines().next().unwrap_or("");
    let vendor = detect_vendor(first_line);
    Some(JavaInfo { version, vendor })
}

/// The platform-specific name of the java executable.
#[cfg(target_os = "windows")]
const JAVA_EXE: &str = "java.exe";
#[cfg(not(target_os = "windows"))]
const JAVA_EXE: &str = "java";

/// The platform-specific name of the javaw executable (Windows only).
#[cfg(target_os = "windows")]
const JAVAW_EXE: &str = "javaw.exe";

/// Collect candidate java executable paths from well-known locations.
fn collect_candidate_paths() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. `java` on PATH (resolved via `which`-style lookup)
    if let Ok(path_var) = env::var("PATH") {
        let sep = if cfg!(target_os = "windows") {
            ';'
        } else {
            ':'
        };
        for dir in path_var.split(sep) {
            let p = Path::new(dir).join(JAVA_EXE);
            candidates.push(p);
            #[cfg(target_os = "windows")]
            {
                candidates.push(Path::new(dir).join(JAVAW_EXE));
            }
        }
    }

    // 2. JAVA_HOME environment variable
    if let Ok(java_home) = env::var("JAVA_HOME") {
        candidates.push(Path::new(&java_home).join("bin").join(JAVA_EXE));
        #[cfg(target_os = "windows")]
        {
            candidates.push(Path::new(&java_home).join("bin").join(JAVAW_EXE));
        }
    }

    // --- Platform-specific base directories ---

    #[cfg(target_os = "macos")]
    {
        // Apple system Java
        candidates.push(PathBuf::from("/usr/bin/java"));
        // Homebrew Intel
        add_children_bin(&mut candidates, "/usr/local/opt", JAVA_EXE);
        // Homebrew Apple Silicon
        add_children_bin(&mut candidates, "/opt/homebrew/opt", JAVA_EXE);
        // Homebrew Cellar Intel
        add_jdk_cellar(&mut candidates, "/usr/local/Cellar", JAVA_EXE);
        // Homebrew Cellar Apple Silicon
        add_jdk_cellar(&mut candidates, "/opt/homebrew/Cellar", JAVA_EXE);
        // Standard macOS JVM location
        add_macos_java_vms(
            &mut candidates,
            "/Library/Java/JavaVirtualMachines",
            JAVA_EXE,
        );
        // Per-user JVM location
        if let Some(home) = env::var_os("HOME") {
            let user_jvms = Path::new(&home).join("Library/Java/JavaVirtualMachines");
            add_macos_java_vms(&mut candidates, user_jvms.to_str().unwrap_or(""), JAVA_EXE);
        }
        // SDKMAN
        if let Some(home) = env::var_os("HOME") {
            let sdkman_dir = env::var("SDKMAN_DIR").unwrap_or_else(|_| {
                Path::new(&home)
                    .join(".sdkman")
                    .to_string_lossy()
                    .to_string()
            });
            add_children_bin(
                &mut candidates,
                &format!("{}/candidates/java", sdkman_dir),
                JAVA_EXE,
            );
        }
        // jabba
        if let Some(home) = env::var_os("HOME") {
            add_children_bin(
                &mut candidates,
                Path::new(&home).join(".jabba/jdk").to_str().unwrap_or(""),
                JAVA_EXE,
            );
        }
        // IntelliJ bundled JBR
        if let Some(home) = env::var_os("HOME") {
            let base = Path::new(&home).join("Library/Application Support/JetBrains/Toolbox/apps");
            add_intellij_jbr(&mut candidates, base.to_str().unwrap_or(""), JAVA_EXE);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Standard Linux JVM locations
        let linux_jvm_dirs = [
            "/usr/lib/jvm",
            "/usr/lib64/jvm",
            "/usr/lib32/jvm",
            "/usr/local/lib/jvm",
            "/usr/java",
        ];
        for dir in &linux_jvm_dirs {
            add_children_bin(&mut candidates, dir, JAVA_EXE);
        }
        // Snap-installed JDKs
        add_children_bin(&mut candidates, "/snap", JAVA_EXE);
        // Flatpak runtime JDKs
        add_children_bin(&mut candidates, "/var/lib/flatpak/runtime", JAVA_EXE);
        // SDKMAN
        if let Some(home) = env::var_os("HOME") {
            let sdkman_dir = env::var("SDKMAN_DIR").unwrap_or_else(|_| {
                Path::new(&home)
                    .join(".sdkman")
                    .to_string_lossy()
                    .to_string()
            });
            add_children_bin(
                &mut candidates,
                &format!("{}/candidates/java", sdkman_dir),
                JAVA_EXE,
            );
        }
        // jabba
        if let Some(home) = env::var_os("HOME") {
            add_children_bin(
                &mut candidates,
                Path::new(&home).join(".jabba/jdk").to_str().unwrap_or(""),
                JAVA_EXE,
            );
        }
        // IntelliJ bundled JBR
        if let Some(home) = env::var_os("HOME") {
            let base = Path::new(&home).join(".local/share/JetBrains/Toolbox/apps");
            add_intellij_jbr(&mut candidates, base.to_str().unwrap_or(""), JAVA_EXE);
        }
        // asdf
        if let Some(home) = env::var_os("HOME") {
            add_children_bin(
                &mut candidates,
                Path::new(&home)
                    .join(".asdf/installs/java")
                    .to_str()
                    .unwrap_or(""),
                JAVA_EXE,
            );
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Common Windows install directories
        let program_files_dirs: Vec<String> = [
            env::var("ProgramFiles").ok(),
            env::var("ProgramFiles(x86)").ok(),
            env::var("ProgramW6432").ok(),
            Some("C:\\Program Files".to_string()),
            Some("C:\\Program Files (x86)".to_string()),
        ]
        .iter()
        .filter_map(|v| v.clone())
        .collect();

        let java_folder_names = [
            "Java",
            "Eclipse Adoptium",
            "AdoptOpenJDK",
            "Microsoft",
            "Zulu",
            "BellSoft",
            "Semeru",
            "Amazon Corretto",
            "Liberica",
            "sapmachine",
        ];

        for pf in &program_files_dirs {
            for folder in &java_folder_names {
                add_children_bin(&mut candidates, &format!("{}\\{}", pf, folder), JAVA_EXE);
                add_children_bin(&mut candidates, &format!("{}\\{}", pf, folder), JAVAW_EXE);
            }
        }

        // Scoop
        if let Some(home) = env::var_os("USERPROFILE") {
            let scoop_dir = env::var("SCOOP")
                .unwrap_or_else(|_| Path::new(&home).join("scoop").to_string_lossy().to_string());
            add_children_bin(
                &mut candidates,
                &format!("{}\\apps\\java", scoop_dir),
                JAVA_EXE,
            );
            add_children_bin(
                &mut candidates,
                &format!("{}\\apps\\java", scoop_dir),
                JAVAW_EXE,
            );
            // Scoop variants: adopt*, zulu*, etc.
            if let Ok(entries) = fs::read_dir(format!("{}\\apps", scoop_dir)) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.contains("jdk") || name.contains("jre") || name.contains("java") {
                        add_children_bin(
                            &mut candidates,
                            entry.path().to_str().unwrap_or(""),
                            JAVA_EXE,
                        );
                    }
                }
            }
        }

        // Chocolatey
        let choco_dir = env::var("ChocolateyInstall")
            .unwrap_or_else(|_| "C:\\ProgramData\\chocolatey".to_string());
        add_children_bin(&mut candidates, &format!("{}\\lib", choco_dir), JAVA_EXE);

        // SDKMAN (WSL paths, rare on native Windows)
        if let Some(home) = env::var_os("USERPROFILE") {
            add_children_bin(
                &mut candidates,
                Path::new(&home)
                    .join(".sdkman\\candidates\\java")
                    .to_str()
                    .unwrap_or(""),
                JAVA_EXE,
            );
        }

        // IntelliJ bundled JBR
        if let Some(home) = env::var_os("LOCALAPPDATA") {
            let base = Path::new(&home).join("JetBrains\\Toolbox\\apps");
            add_intellij_jbr(&mut candidates, base.to_str().unwrap_or(""), JAVA_EXE);
        }
    }

    candidates
}

/// List subdirectories of `base_dir` and add `<child>/bin/<exe_name>` for each.
fn add_children_bin(candidates: &mut Vec<PathBuf>, base_dir: &str, exe_name: &str) {
    if let Ok(entries) = fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                candidates.push(entry.path().join("bin").join(exe_name));
            }
        }
    }
}

/// macOS: `<base>/<jdk>/Contents/Home/bin/<exe>` layout.
#[cfg(target_os = "macos")]
fn add_macos_java_vms(candidates: &mut Vec<PathBuf>, base_dir: &str, exe_name: &str) {
    if let Ok(entries) = fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                candidates.push(
                    entry
                        .path()
                        .join("Contents")
                        .join("Home")
                        .join("bin")
                        .join(exe_name),
                );
            }
        }
    }
}

/// Homebrew Cellar: `<cellar>/openjdk*/*/libexec/openjdk.jdk/Contents/Home/bin/<exe>`
/// and also `<cellar>/openjdk*/*/bin/<exe>`.
#[cfg(target_os = "macos")]
fn add_jdk_cellar(candidates: &mut Vec<PathBuf>, cellar_dir: &str, exe_name: &str) {
    if let Ok(entries) = fs::read_dir(cellar_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("openjdk") {
                // Version subdirectories
                if let Ok(versions) = fs::read_dir(entry.path()) {
                    for ver in versions.flatten() {
                        candidates.push(ver.path().join("bin").join(exe_name));
                        candidates.push(
                            ver.path()
                                .join("libexec")
                                .join("openjdk.jdk")
                                .join("Contents")
                                .join("Home")
                                .join("bin")
                                .join(exe_name),
                        );
                    }
                }
            }
        }
    }
}

/// IntelliJ/JetBrains bundled JBR: look for jbr/bin/<exe> inside app directories.
fn add_intellij_jbr(candidates: &mut Vec<PathBuf>, apps_dir: &str, exe_name: &str) {
    if let Ok(entries) = fs::read_dir(apps_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                // Check for jbr directly inside the app
                let jbr_path = entry.path().join("jbr").join("bin").join(exe_name);
                candidates.push(jbr_path);
                // Some versions nest inside a channel directory
                if let Ok(children) = fs::read_dir(entry.path()) {
                    for child in children.flatten() {
                        if child.path().is_dir() {
                            candidates.push(child.path().join("jbr").join("bin").join(exe_name));
                        }
                    }
                }
            }
        }
    }
}

/// Resolve a path to its canonical form, following symlinks.
fn resolve_path(p: &Path) -> PathBuf {
    fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

#[tauri::command]
pub async fn detect_java_runtimes() -> Result<Vec<DetectedJava>, String> {
    let candidates = collect_candidate_paths();

    let mut seen = HashSet::new();
    let mut results: Vec<DetectedJava> = Vec::new();

    for candidate in &candidates {
        // Skip if the file does not exist
        if !candidate.is_file() {
            continue;
        }
        // Resolve symlinks to avoid duplicates
        let resolved = resolve_path(candidate);
        if !seen.insert(resolved.clone()) {
            continue;
        }
        let path_str = candidate.to_string_lossy().to_string();
        if let Some(info) = try_get_java_info(&path_str) {
            results.push(DetectedJava {
                pathname: path_str,
                version: info.version,
                vendor: info.vendor,
            });
        }
    }

    Ok(results)
}
