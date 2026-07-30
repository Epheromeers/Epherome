use flate2::read::DeflateDecoder;
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use toml::Value as TomlValue;

const DISABLED_SUFFIX: &str = ".disabled";
const IMPORT_TEMP_CREATE_ATTEMPTS: usize = 128;
const MAX_METADATA_FILE_SIZE: u64 = 1024 * 1024;
const MAX_METADATA_COMPRESSED_SIZE: u64 = 4 * 1024 * 1024;
const MAX_METADATA_ENTRIES_PER_DESCRIPTOR: usize = 128;
const MAX_DEPENDENCIES_PER_ENTRY: usize = 256;
const MAX_METADATA_ENTRIES_PER_JAR: usize = 128;
const MAX_DEPENDENCIES_PER_JAR: usize = 512;
const MAX_METADATA_FIELD_BYTES: usize = 4096;
const MAX_METADATA_PEOPLE_PER_ENTRY: usize = 256;
const MAX_METADATA_SERIALIZED_BYTES_PER_JAR: usize = 512 * 1024;
const MAX_METADATA_DIAGNOSTICS: usize = 64;
const MAX_ZIP_CENTRAL_DIRECTORY_SIZE: u64 = 32 * 1024 * 1024;
const MAX_ZIP_ENTRIES: u64 = 100_000;
const MAX_ZIP64_EXTENSIBLE_DATA_SIZE: u64 = 1024 * 1024;
const ZIP_EOCD_MIN_SIZE: u64 = 22;
const ZIP_EOCD_MAX_SEARCH: u64 = ZIP_EOCD_MIN_SIZE + u16::MAX as u64;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIZE: u64 = 46;
const ZIP_LOCAL_FILE_HEADER_SIZE: u64 = 30;
const ZIP_TARGET_PATH_BUFFER_SIZE: usize = 64;
const ZIP_ENCRYPTION_FLAGS: u16 = 0x2041;
const ZIP64_EXTRA_FIELD_ID: u16 = 0x0001;
const MANIFEST_PATH: &str = "META-INF/MANIFEST.MF";
const MOD_DESCRIPTOR_PATHS: [&str; 5] = [
    "fabric.mod.json",
    "quilt.mod.json",
    "META-INF/mods.toml",
    "META-INF/neoforge.mods.toml",
    "mcmod.info",
];
const ZIP_TARGET_PATHS: [&str; 6] = [
    MANIFEST_PATH,
    "fabric.mod.json",
    "quilt.mod.json",
    "META-INF/mods.toml",
    "META-INF/neoforge.mods.toml",
    "mcmod.info",
];
const TRUNCATED_FIELD_SUFFIX: &str = "… [truncated]";

static MODS_OPERATION_LOCK: Mutex<()> = Mutex::const_new(());
static IMPORT_TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModFile {
    pub filename: String,
    pub enabled: bool,
    pub size: u64,
    pub metadata: LocalModMetadata,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModMetadata {
    pub entries: Vec<LocalModMetadataEntry>,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModMetadataEntry {
    pub source: String,
    pub loader: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub authors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loader_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_loader: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_loader_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    pub dependencies: Vec<LocalModDependency>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModDependency {
    pub relation: String,
    pub mod_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ordering: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModImportFailure {
    pub filename: String,
    pub reason: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalModImportResult {
    pub imported: Vec<String>,
    pub failed: Vec<LocalModImportFailure>,
}

fn mods_directory(game_directory: &str) -> Result<PathBuf, String> {
    if game_directory.trim().is_empty() {
        return Err("Game directory cannot be empty.".to_string());
    }

    let game_directory = PathBuf::from(game_directory);
    let metadata = fs::metadata(&game_directory).map_err(|error| {
        format!(
            "Failed to access game directory '{}': {}",
            game_directory.display(),
            error
        )
    })?;

    if !metadata.is_dir() {
        return Err(format!(
            "Game directory '{}' is not a directory.",
            game_directory.display()
        ));
    }

    Ok(game_directory.join("mods"))
}

fn ensure_existing_mods_directory(mods_directory: &Path) -> Result<bool, String> {
    let metadata = match fs::symlink_metadata(mods_directory) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => {
            return Err(format!(
                "Failed to access mods directory '{}': {}",
                mods_directory.display(),
                error
            ));
        }
    };

    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Mods directory '{}' cannot be a symbolic link.",
            mods_directory.display()
        ));
    }

    if !metadata.is_dir() {
        return Err(format!(
            "Mods path '{}' is not a directory.",
            mods_directory.display()
        ));
    }

    Ok(true)
}

fn create_mods_directory(mods_directory: &Path) -> Result<(), String> {
    if ensure_existing_mods_directory(mods_directory)? {
        return Ok(());
    }

    fs::create_dir(mods_directory).map_err(|error| {
        format!(
            "Failed to create mods directory '{}': {}",
            mods_directory.display(),
            error
        )
    })
}

fn is_enabled_mod_filename(filename: &str) -> bool {
    filename.to_ascii_lowercase().ends_with(".jar")
}

fn is_disabled_mod_filename(filename: &str) -> bool {
    filename.to_ascii_lowercase().ends_with(".jar.disabled")
}

fn is_mod_filename(filename: &str) -> bool {
    is_enabled_mod_filename(filename) || is_disabled_mod_filename(filename)
}

fn enabled_filename(filename: &str) -> Option<String> {
    let prefix_length = filename.len().checked_sub(DISABLED_SUFFIX.len())?;
    let suffix = filename.get(prefix_length..)?;
    if !suffix.eq_ignore_ascii_case(DISABLED_SUFFIX) {
        return None;
    }

    Some(filename.get(..prefix_length)?.to_string())
}

fn validate_single_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() || filename == "." || filename == ".." {
        return Err("Mod filename is invalid.".to_string());
    }

    if filename.contains('/') || filename.contains('\\') {
        return Err("Mod filename must not contain path separators.".to_string());
    }

    let mut components = Path::new(filename).components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err("Mod filename must be a single file name.".to_string());
    }

    Ok(())
}

fn validate_mod_filename(filename: &str) -> Result<(), String> {
    validate_single_filename(filename)?;
    if !is_mod_filename(filename) {
        return Err("Mod filename must end with '.jar' or '.jar.disabled'.".to_string());
    }
    Ok(())
}

fn validate_import_filename(filename: &str) -> Result<(), String> {
    validate_single_filename(filename)?;
    if !is_enabled_mod_filename(filename) {
        return Err("Only '.jar' files can be imported.".to_string());
    }
    Ok(())
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "Failed to check destination '{}': {}",
            path.display(),
            error
        )),
    }
}

#[cfg(any(target_os = "linux", target_os = "android", target_vendor = "apple"))]
fn rename_without_overwrite(source: &Path, destination: &Path) -> Result<(), io::Error> {
    rustix::fs::renameat_with(
        rustix::fs::CWD,
        source,
        rustix::fs::CWD,
        destination,
        rustix::fs::RenameFlags::NOREPLACE,
    )
    .map_err(io::Error::from)
}

#[cfg(target_os = "windows")]
fn rename_without_overwrite(source: &Path, destination: &Path) -> Result<(), io::Error> {
    // Windows rename semantics reject an existing destination.
    fs::rename(source, destination)
}

#[cfg(not(any(
    target_os = "linux",
    target_os = "android",
    target_vendor = "apple",
    target_os = "windows"
)))]
fn rename_without_overwrite(source: &Path, destination: &Path) -> Result<(), io::Error> {
    match fs::symlink_metadata(destination) {
        Ok(_) => {
            return Err(io::Error::new(
                io::ErrorKind::AlreadyExists,
                "Destination already exists.",
            ));
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }

    fs::rename(source, destination)
}

fn create_import_temp_file(mods_directory: &Path) -> Result<(PathBuf, File), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    for _ in 0..IMPORT_TEMP_CREATE_ATTEMPTS {
        let counter = IMPORT_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let filename = format!(
            ".epherome-mod-import-{}-{timestamp}-{counter}.tmp",
            std::process::id()
        );
        let path = mods_directory.join(filename);

        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "Failed to create temporary import file in '{}': {}",
                    mods_directory.display(),
                    error
                ));
            }
        }
    }

    Err(format!(
        "Failed to create a unique temporary import file in '{}'.",
        mods_directory.display()
    ))
}

fn remove_file_if_exists(path: &Path) -> Result<(), io::Error> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn cleanup_import_failure(temp_path: &Path, reason: String) -> String {
    match remove_file_if_exists(temp_path) {
        Ok(()) => reason,
        Err(cleanup_error) => format!(
            "{reason} Also failed to remove temporary file '{}': {cleanup_error}",
            temp_path.display()
        ),
    }
}

fn publish_import_temp(temp_path: &Path, destination: &Path, filename: &str) -> Result<(), String> {
    if let Err(error) = rename_without_overwrite(temp_path, destination) {
        let reason = if error.kind() == io::ErrorKind::AlreadyExists {
            format!("A mod named '{filename}' was installed while the import was in progress.")
        } else {
            format!(
                "Failed to atomically install '{filename}' without overwriting another file: {error}"
            )
        };
        return Err(cleanup_import_failure(temp_path, reason));
    }

    Ok(())
}

fn non_empty_string(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    if value.len() <= MAX_METADATA_FIELD_BYTES {
        return Some(value.to_string());
    }

    let content_limit = MAX_METADATA_FIELD_BYTES.saturating_sub(TRUNCATED_FIELD_SUFFIX.len());
    let mut end = content_limit.min(value.len());
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    Some(format!("{}{TRUNCATED_FIELD_SUFFIX}", &value[..end]))
}

fn json_value_text(value: &JsonValue) -> Option<String> {
    match value {
        JsonValue::Null => None,
        JsonValue::String(value) => non_empty_string(value),
        JsonValue::Bool(value) => Some(value.to_string()),
        JsonValue::Number(value) => Some(value.to_string()),
        JsonValue::Array(_) | JsonValue::Object(_) => serde_json::to_string(value)
            .ok()
            .and_then(|value| non_empty_string(&value)),
    }
}

fn json_object_text(object: &serde_json::Map<String, JsonValue>, key: &str) -> Option<String> {
    object.get(key).and_then(json_value_text)
}

fn json_authors(value: Option<&JsonValue>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };

    match value {
        JsonValue::Array(values) => values
            .iter()
            .take(MAX_METADATA_PEOPLE_PER_ENTRY + 1)
            .filter_map(|value| match value {
                JsonValue::Object(person) => json_object_text(person, "name"),
                _ => json_value_text(value),
            })
            .collect(),
        JsonValue::Object(person) => json_object_text(person, "name").into_iter().collect(),
        _ => json_value_text(value).into_iter().collect(),
    }
}

fn quilt_contributors(value: Option<&JsonValue>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };

    match value {
        JsonValue::Object(contributors) => contributors
            .iter()
            .take(MAX_METADATA_PEOPLE_PER_ENTRY + 1)
            .filter_map(|(name, roles)| {
                let name = non_empty_string(name)?;
                let roles = match roles {
                    JsonValue::Array(roles) => roles
                        .iter()
                        .filter_map(json_value_text)
                        .collect::<Vec<_>>()
                        .join(", "),
                    _ => json_value_text(roles).unwrap_or_default(),
                };
                if roles.is_empty() {
                    Some(name)
                } else {
                    non_empty_string(&format!("{name} ({roles})"))
                }
            })
            .collect(),
        _ => json_authors(Some(value)),
    }
}

fn dependency_version(dependencies: &[LocalModDependency], mod_ids: &[&str]) -> Option<String> {
    dependencies
        .iter()
        .find(|dependency| {
            mod_ids
                .iter()
                .any(|mod_id| dependency.mod_id.eq_ignore_ascii_case(mod_id))
        })
        .and_then(|dependency| dependency.version.clone())
}

fn append_fabric_dependencies(
    root: &serde_json::Map<String, JsonValue>,
    relation: &str,
    dependencies: &mut Vec<LocalModDependency>,
) {
    if dependencies.len() > MAX_DEPENDENCIES_PER_ENTRY {
        return;
    }
    let Some(JsonValue::Object(items)) = root.get(relation) else {
        return;
    };

    let remaining = (MAX_DEPENDENCIES_PER_ENTRY + 1).saturating_sub(dependencies.len());
    dependencies.extend(
        items
            .iter()
            .take(remaining)
            .filter_map(|(mod_id, version)| {
                Some(LocalModDependency {
                    relation: relation.to_string(),
                    mod_id: non_empty_string(mod_id)?,
                    version: json_value_text(version),
                    required: None,
                    side: None,
                    ordering: None,
                })
            }),
    );
}

fn fabric_metadata_entry(
    root: &serde_json::Map<String, JsonValue>,
    source: &str,
) -> LocalModMetadataEntry {
    let mut dependencies = Vec::new();
    for relation in ["depends", "recommends", "suggests", "conflicts", "breaks"] {
        append_fabric_dependencies(root, relation, &mut dependencies);
    }

    let loader_version = dependency_version(&dependencies, &["fabricloader"]);
    let game_version = dependency_version(&dependencies, &["minecraft"]);
    let mut authors = json_authors(root.get("authors"));
    authors.extend(
        json_authors(root.get("contributors"))
            .into_iter()
            .filter_map(|contributor| non_empty_string(&format!("{contributor} (Contributor)"))),
    );
    authors.truncate(MAX_METADATA_PEOPLE_PER_ENTRY + 1);

    LocalModMetadataEntry {
        source: source.to_string(),
        loader: "Fabric".to_string(),
        name: json_object_text(root, "name"),
        version: json_object_text(root, "version"),
        authors,
        mod_id: json_object_text(root, "id"),
        loader_version,
        language_loader: None,
        language_loader_version: None,
        game_version,
        environment: root.get("environment").and_then(json_value_text),
        dependencies,
    }
}

fn parse_fabric_metadata(text: &str, source: &str) -> Result<Vec<LocalModMetadataEntry>, String> {
    let document: JsonValue =
        serde_json::from_str(text).map_err(|error| format!("Invalid JSON: {error}"))?;

    match &document {
        JsonValue::Object(root) => Ok(vec![fabric_metadata_entry(root, source)]),
        JsonValue::Array(values) => Ok(values
            .iter()
            .take(MAX_METADATA_ENTRIES_PER_DESCRIPTOR + 1)
            .filter_map(JsonValue::as_object)
            .map(|root| fabric_metadata_entry(root, source))
            .collect()),
        _ => Err("The metadata root must be a JSON object or array.".to_string()),
    }
}

fn quilt_dependency_constraint(object: &serde_json::Map<String, JsonValue>) -> Option<String> {
    let versions = object.get("versions").or_else(|| object.get("version"));
    let unless = object.get("unless");

    if unless.is_none() {
        return versions.and_then(json_value_text);
    }

    let mut constraint = serde_json::Map::new();
    if let Some(versions) = versions {
        constraint.insert("versions".to_string(), versions.clone());
    }
    if let Some(unless) = unless {
        constraint.insert("unless".to_string(), unless.clone());
    }
    serde_json::to_string(&JsonValue::Object(constraint)).ok()
}

fn append_quilt_dependency(
    value: &JsonValue,
    relation: &str,
    dependencies: &mut Vec<LocalModDependency>,
) {
    if dependencies.len() > MAX_DEPENDENCIES_PER_ENTRY {
        return;
    }

    match value {
        JsonValue::Array(items) => {
            for item in items {
                append_quilt_dependency(item, relation, dependencies);
            }
        }
        JsonValue::Object(object) if object.contains_key("id") => {
            let mod_id = match object.get("id") {
                Some(JsonValue::Object(id)) => json_object_text(id, "id"),
                Some(value) => json_value_text(value),
                None => None,
            };
            let Some(mod_id) = mod_id else {
                return;
            };
            let required = object
                .get("optional")
                .and_then(JsonValue::as_bool)
                .map(|optional| !optional);
            dependencies.push(LocalModDependency {
                relation: relation.to_string(),
                mod_id,
                version: quilt_dependency_constraint(object),
                required,
                side: object
                    .get("environment")
                    .or_else(|| object.get("side"))
                    .and_then(json_value_text),
                ordering: object.get("ordering").and_then(json_value_text),
            });
        }
        JsonValue::Object(items) => {
            let remaining = (MAX_DEPENDENCIES_PER_ENTRY + 1).saturating_sub(dependencies.len());
            dependencies.extend(
                items
                    .iter()
                    .take(remaining)
                    .filter_map(|(mod_id, version)| {
                        Some(LocalModDependency {
                            relation: relation.to_string(),
                            mod_id: non_empty_string(mod_id)?,
                            version: json_value_text(version),
                            required: None,
                            side: None,
                            ordering: None,
                        })
                    }),
            );
        }
        _ => {
            if let Some(mod_id) = json_value_text(value) {
                dependencies.push(LocalModDependency {
                    relation: relation.to_string(),
                    mod_id,
                    version: None,
                    required: None,
                    side: None,
                    ordering: None,
                });
            }
        }
    }
}

fn parse_quilt_metadata(text: &str, source: &str) -> Result<Vec<LocalModMetadataEntry>, String> {
    let document: JsonValue =
        serde_json::from_str(text).map_err(|error| format!("Invalid JSON: {error}"))?;
    let root = document
        .as_object()
        .ok_or_else(|| "The metadata root must be a JSON object.".to_string())?;
    let quilt_loader = root
        .get("quilt_loader")
        .and_then(JsonValue::as_object)
        .ok_or_else(|| "The metadata does not contain a quilt_loader object.".to_string())?;
    let metadata = quilt_loader.get("metadata").and_then(JsonValue::as_object);

    let mut dependencies = Vec::new();
    for relation in ["depends", "breaks"] {
        if let Some(value) = quilt_loader.get(relation) {
            append_quilt_dependency(value, relation, &mut dependencies);
        }
    }

    let loader_version = dependency_version(&dependencies, &["quilt_loader"]);
    let game_version = dependency_version(&dependencies, &["minecraft"]);
    let authors = metadata
        .map(|metadata| quilt_contributors(metadata.get("contributors")))
        .filter(|authors| !authors.is_empty())
        .unwrap_or_else(|| {
            metadata
                .map(|metadata| json_authors(metadata.get("authors")))
                .unwrap_or_default()
        });

    Ok(vec![LocalModMetadataEntry {
        source: source.to_string(),
        loader: "Quilt".to_string(),
        name: metadata.and_then(|metadata| json_object_text(metadata, "name")),
        version: json_object_text(quilt_loader, "version"),
        authors,
        mod_id: json_object_text(quilt_loader, "id"),
        loader_version,
        language_loader: None,
        language_loader_version: None,
        game_version,
        environment: root
            .get("minecraft")
            .and_then(JsonValue::as_object)
            .and_then(|minecraft| minecraft.get("environment"))
            .and_then(json_value_text),
        dependencies,
    }])
}

fn toml_value_text(value: &TomlValue) -> Option<String> {
    match value {
        TomlValue::String(value) => non_empty_string(value),
        TomlValue::Integer(value) => Some(value.to_string()),
        TomlValue::Float(value) => Some(value.to_string()),
        TomlValue::Boolean(value) => Some(value.to_string()),
        TomlValue::Datetime(value) => Some(value.to_string()),
        TomlValue::Array(_) | TomlValue::Table(_) => non_empty_string(&value.to_string()),
    }
}

fn toml_object_text(object: &toml::Table, key: &str) -> Option<String> {
    object.get(key).and_then(toml_value_text)
}

fn toml_authors(value: Option<&TomlValue>) -> Vec<String> {
    let Some(value) = value else {
        return Vec::new();
    };

    match value {
        TomlValue::Array(values) => values
            .iter()
            .take(MAX_METADATA_PEOPLE_PER_ENTRY + 1)
            .filter_map(toml_value_text)
            .collect(),
        _ => toml_value_text(value).into_iter().collect(),
    }
}

fn forge_dependencies(
    root: &toml::Table,
    owner_mod_id: Option<&str>,
    limit: usize,
) -> Vec<LocalModDependency> {
    let Some(owner_mod_id) = owner_mod_id else {
        return Vec::new();
    };
    let Some(dependencies_table) = root.get("dependencies").and_then(TomlValue::as_table) else {
        return Vec::new();
    };
    let Some(entries) = dependencies_table
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(owner_mod_id))
        .map(|(_, value)| value)
    else {
        return Vec::new();
    };

    let values = match entries {
        TomlValue::Array(values) => values.as_slice(),
        _ => std::slice::from_ref(entries),
    };

    values
        .iter()
        .take(limit)
        .filter_map(TomlValue::as_table)
        .filter_map(|dependency| {
            let mod_id = toml_object_text(dependency, "modId")?;
            let relation =
                toml_object_text(dependency, "type").unwrap_or_else(|| "dependency".to_string());
            let required = dependency
                .get("mandatory")
                .and_then(TomlValue::as_bool)
                .or_else(|| {
                    dependency
                        .get("type")
                        .and_then(TomlValue::as_str)
                        .and_then(|dependency_type| {
                            if dependency_type.eq_ignore_ascii_case("required") {
                                Some(true)
                            } else if dependency_type.eq_ignore_ascii_case("optional") {
                                Some(false)
                            } else {
                                None
                            }
                        })
                });
            Some(LocalModDependency {
                relation,
                mod_id,
                version: dependency
                    .get("versionRange")
                    .or_else(|| dependency.get("version"))
                    .and_then(toml_value_text),
                required,
                side: dependency.get("side").and_then(toml_value_text),
                ordering: dependency.get("ordering").and_then(toml_value_text),
            })
        })
        .collect()
}

fn resolve_forge_version(value: Option<String>, jar_version: Option<&str>) -> Option<String> {
    match value {
        Some(value) if value.trim() == "${file.jarVersion}" => {
            jar_version.and_then(non_empty_string).or(Some(value))
        }
        value => value,
    }
}

fn parse_forge_metadata(
    text: &str,
    source: &str,
    loader: &str,
    jar_version: Option<&str>,
) -> Result<Vec<LocalModMetadataEntry>, String> {
    let document: TomlValue =
        toml::from_str(text).map_err(|error| format!("Invalid TOML: {error}"))?;
    let root = document
        .as_table()
        .ok_or_else(|| "The metadata root must be a TOML table.".to_string())?;
    let mods = root
        .get("mods")
        .and_then(TomlValue::as_array)
        .ok_or_else(|| "The metadata does not contain any [[mods]] entries.".to_string())?;
    let language_loader = root.get("modLoader").and_then(toml_value_text);
    let language_loader_version = root.get("loaderVersion").and_then(toml_value_text);
    let mut remaining_dependency_budget = MAX_DEPENDENCIES_PER_JAR + 1;

    Ok(mods
        .iter()
        .take(MAX_METADATA_ENTRIES_PER_DESCRIPTOR + 1)
        .filter_map(TomlValue::as_table)
        .map(|mod_entry| {
            let mod_id = toml_object_text(mod_entry, "modId");
            let dependency_limit = remaining_dependency_budget.min(MAX_DEPENDENCIES_PER_ENTRY + 1);
            let dependencies = forge_dependencies(root, mod_id.as_deref(), dependency_limit);
            remaining_dependency_budget =
                remaining_dependency_budget.saturating_sub(dependencies.len());
            let game_version = dependency_version(&dependencies, &["minecraft"]);
            let loader_version = if loader == "NeoForge" {
                dependency_version(&dependencies, &["neoforge"])
            } else {
                dependency_version(&dependencies, &["forge", "neoforge"])
            };

            LocalModMetadataEntry {
                source: source.to_string(),
                loader: loader.to_string(),
                name: mod_entry
                    .get("displayName")
                    .or_else(|| mod_entry.get("name"))
                    .and_then(toml_value_text),
                version: resolve_forge_version(
                    mod_entry.get("version").and_then(toml_value_text),
                    jar_version,
                ),
                authors: toml_authors(mod_entry.get("authors")),
                mod_id,
                loader_version,
                language_loader: language_loader.clone(),
                language_loader_version: language_loader_version.clone(),
                game_version,
                environment: mod_entry
                    .get("side")
                    .or_else(|| mod_entry.get("displayTest"))
                    .and_then(toml_value_text),
                dependencies,
            }
        })
        .collect())
}

fn legacy_dependency_from_string(
    value: &str,
    default_relation: &str,
) -> Option<LocalModDependency> {
    let value = non_empty_string(value)?;
    let value = value.as_str();

    let (relation, target) = value
        .split_once(':')
        .map(|(relation, target)| (relation.trim(), target.trim()))
        .unwrap_or((default_relation, value));
    let (mod_id, version) = target
        .split_once('@')
        .map(|(mod_id, version)| (mod_id.trim(), non_empty_string(version)))
        .unwrap_or((target.trim(), None));
    let mod_id = non_empty_string(mod_id)?;

    Some(LocalModDependency {
        relation: non_empty_string(relation)?,
        mod_id,
        version,
        required: None,
        side: None,
        ordering: None,
    })
}

fn append_legacy_dependencies(
    value: &JsonValue,
    default_relation: &str,
    dependencies: &mut Vec<LocalModDependency>,
) {
    if dependencies.len() > MAX_DEPENDENCIES_PER_ENTRY {
        return;
    }

    match value {
        JsonValue::Array(values) => {
            for value in values {
                append_legacy_dependencies(value, default_relation, dependencies);
            }
        }
        JsonValue::String(value) => {
            if let Some(dependency) = legacy_dependency_from_string(value, default_relation) {
                dependencies.push(dependency);
            }
        }
        JsonValue::Object(object) => {
            let mod_id = object
                .get("modid")
                .or_else(|| object.get("modId"))
                .or_else(|| object.get("id"))
                .and_then(json_value_text);
            let Some(mod_id) = mod_id else {
                return;
            };
            dependencies.push(LocalModDependency {
                relation: object
                    .get("relation")
                    .or_else(|| object.get("type"))
                    .and_then(json_value_text)
                    .unwrap_or_else(|| default_relation.to_string()),
                mod_id,
                version: object
                    .get("versionRange")
                    .or_else(|| object.get("version"))
                    .and_then(json_value_text),
                required: object.get("required").and_then(JsonValue::as_bool),
                side: object.get("side").and_then(json_value_text),
                ordering: object.get("ordering").and_then(json_value_text),
            });
        }
        _ => {}
    }
}

fn parse_mcmod_metadata(text: &str, source: &str) -> Result<Vec<LocalModMetadataEntry>, String> {
    let document: JsonValue =
        serde_json::from_str(text).map_err(|error| format!("Invalid JSON: {error}"))?;
    let entries = match &document {
        JsonValue::Array(entries) => entries.as_slice(),
        JsonValue::Object(root) => match root.get("modList") {
            Some(JsonValue::Array(entries)) => entries.as_slice(),
            _ => std::slice::from_ref(&document),
        },
        _ => {
            return Err("The metadata root must be a JSON object or array.".to_string());
        }
    };

    Ok(entries
        .iter()
        .take(MAX_METADATA_ENTRIES_PER_DESCRIPTOR + 1)
        .filter_map(JsonValue::as_object)
        .map(|entry| {
            let mut dependencies = Vec::new();
            for (field, relation) in [
                ("requiredMods", "required"),
                ("dependencies", "dependency"),
                ("dependants", "dependant"),
            ] {
                if let Some(value) = entry.get(field) {
                    append_legacy_dependencies(value, relation, &mut dependencies);
                }
            }
            let loader_version = dependency_version(&dependencies, &["forge"]);

            LocalModMetadataEntry {
                source: source.to_string(),
                loader: "Forge Legacy".to_string(),
                name: json_object_text(entry, "name"),
                version: json_object_text(entry, "version"),
                authors: json_authors(
                    entry
                        .get("authorList")
                        .or_else(|| entry.get("authors"))
                        .or_else(|| entry.get("author")),
                ),
                mod_id: entry
                    .get("modid")
                    .or_else(|| entry.get("modId"))
                    .or_else(|| entry.get("id"))
                    .and_then(json_value_text),
                loader_version,
                language_loader: None,
                language_loader_version: None,
                game_version: entry
                    .get("mcversion")
                    .or_else(|| entry.get("minecraftVersion"))
                    .and_then(json_value_text),
                environment: entry.get("side").and_then(json_value_text),
                dependencies,
            }
        })
        .collect())
}

fn little_endian_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    let bytes = bytes.get(offset..offset + 2)?;
    Some(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn little_endian_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    let bytes = bytes.get(offset..offset + 4)?;
    Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn little_endian_u64(bytes: &[u8], offset: usize) -> Option<u64> {
    let bytes = bytes.get(offset..offset + 8)?;
    Some(u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ]))
}

fn read_file_range(file: &mut File, offset: u64, length: usize) -> Result<Vec<u8>, String> {
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| format!("Failed to seek in the JAR: {error}"))?;
    let mut bytes = vec![0; length];
    file.read_exact(&mut bytes)
        .map_err(|error| format!("Failed to read the JAR directory: {error}"))?;
    Ok(bytes)
}

struct ZipDirectorySummary {
    entry_count: u64,
    declared_size: u64,
    offset: u64,
    end_structure_offset: u64,
}

#[derive(Clone, Copy)]
struct ZipTargetEntry {
    flags: u16,
    compression_method: u16,
    compressed_size: u64,
    uncompressed_size: u64,
    local_header_offset: u64,
}

enum ZipTargetRecord {
    Entry(ZipTargetEntry),
    Invalid(String),
}

struct InspectedZipArchive {
    directory: ZipDirectorySummary,
    targets: [Option<ZipTargetRecord>; ZIP_TARGET_PATHS.len()],
}

fn zip_directory_summary(file: &mut File) -> Result<ZipDirectorySummary, String> {
    let file_size = file
        .metadata()
        .map_err(|error| format!("Failed to inspect the JAR size: {error}"))?
        .len();
    if file_size < ZIP_EOCD_MIN_SIZE {
        return Err("The JAR is too small to contain a ZIP directory.".to_string());
    }

    let search_length = file_size.min(ZIP_EOCD_MAX_SEARCH);
    let tail = read_file_range(
        file,
        file_size - search_length,
        usize::try_from(search_length)
            .map_err(|_| "The ZIP directory search range is too large.".to_string())?,
    )?;
    let end_record_index = (0..=tail.len() - ZIP_EOCD_MIN_SIZE as usize)
        .rev()
        .find(|index| {
            if tail.get(*index..*index + 4) != Some(b"PK\x05\x06") {
                return false;
            }
            let Some(comment_length) = little_endian_u16(&tail, *index + 20) else {
                return false;
            };
            *index + ZIP_EOCD_MIN_SIZE as usize + comment_length as usize == tail.len()
        })
        .ok_or_else(|| "The JAR does not contain a valid ZIP end record.".to_string())?;

    let entry_count = little_endian_u16(&tail, end_record_index + 10)
        .ok_or_else(|| "The ZIP end record is incomplete.".to_string())?;
    let central_directory_size = little_endian_u32(&tail, end_record_index + 12)
        .ok_or_else(|| "The ZIP end record is incomplete.".to_string())?;
    let central_directory_offset = little_endian_u32(&tail, end_record_index + 16)
        .ok_or_else(|| "The ZIP end record is incomplete.".to_string())?;
    let end_record_offset = file_size - search_length + end_record_index as u64;

    if entry_count != u16::MAX
        && central_directory_size != u32::MAX
        && central_directory_offset != u32::MAX
    {
        return Ok(ZipDirectorySummary {
            entry_count: entry_count as u64,
            declared_size: central_directory_size as u64,
            offset: central_directory_offset as u64,
            end_structure_offset: end_record_offset,
        });
    }

    let locator_offset = end_record_offset
        .checked_sub(20)
        .ok_or_else(|| "The ZIP64 locator is missing.".to_string())?;
    let locator = read_file_range(file, locator_offset, 20)?;
    if locator.get(0..4) != Some(b"PK\x06\x07") {
        return Err("The ZIP64 locator is missing or invalid.".to_string());
    }
    let zip64_end_offset = little_endian_u64(&locator, 8)
        .ok_or_else(|| "The ZIP64 locator is incomplete.".to_string())?;
    let zip64_end = read_file_range(file, zip64_end_offset, 56)?;
    if zip64_end.get(0..4) != Some(b"PK\x06\x06") {
        return Err("The ZIP64 end record is missing or invalid.".to_string());
    }
    let zip64_record_size = little_endian_u64(&zip64_end, 4)
        .ok_or_else(|| "The ZIP64 end record is incomplete.".to_string())?;
    if zip64_record_size < 44 {
        return Err("The ZIP64 end record is too short.".to_string());
    }
    if zip64_record_size - 44 > MAX_ZIP64_EXTENSIBLE_DATA_SIZE {
        return Err(format!(
            "The ZIP64 extensible data sector is {} bytes; the inspection limit is {MAX_ZIP64_EXTENSIBLE_DATA_SIZE} bytes.",
            zip64_record_size - 44
        ));
    }
    let zip64_end_record_end = zip64_end_offset
        .checked_add(12)
        .and_then(|offset| offset.checked_add(zip64_record_size))
        .ok_or_else(|| "The ZIP64 end record size overflows the JAR.".to_string())?;
    if zip64_end_record_end > locator_offset {
        return Err("The ZIP64 end record overlaps its locator.".to_string());
    }

    let entry_count = little_endian_u64(&zip64_end, 32)
        .ok_or_else(|| "The ZIP64 entry count is missing.".to_string())?;
    let central_directory_size = little_endian_u64(&zip64_end, 40)
        .ok_or_else(|| "The ZIP64 directory size is missing.".to_string())?;
    let central_directory_offset = little_endian_u64(&zip64_end, 48)
        .ok_or_else(|| "The ZIP64 directory offset is missing.".to_string())?;
    Ok(ZipDirectorySummary {
        entry_count,
        declared_size: central_directory_size,
        offset: central_directory_offset,
        end_structure_offset: zip64_end_offset,
    })
}

fn zip_target_path_index(path: &[u8]) -> Option<usize> {
    ZIP_TARGET_PATHS
        .iter()
        .position(|target| target.as_bytes() == path)
}

fn read_zip64_target_entry(
    file: &mut File,
    extra_offset: u64,
    extra_length: u64,
    compressed_size_32: u32,
    uncompressed_size_32: u32,
    local_header_offset_32: u32,
    disk_start_16: u16,
) -> Result<(u64, u64, u64), String> {
    let needs_uncompressed_size = uncompressed_size_32 == u32::MAX;
    let needs_compressed_size = compressed_size_32 == u32::MAX;
    let needs_local_header_offset = local_header_offset_32 == u32::MAX;
    let needs_disk_start = disk_start_16 == u16::MAX;
    if !needs_uncompressed_size
        && !needs_compressed_size
        && !needs_local_header_offset
        && !needs_disk_start
    {
        if disk_start_16 != 0 {
            return Err("Multi-disk ZIP entries are not supported.".to_string());
        }
        return Ok((
            compressed_size_32 as u64,
            uncompressed_size_32 as u64,
            local_header_offset_32 as u64,
        ));
    }

    let extra_end = extra_offset
        .checked_add(extra_length)
        .ok_or_else(|| "The ZIP extra field range overflows the JAR.".to_string())?;
    let mut position = extra_offset;
    let mut extra_header = [0_u8; 4];
    while position < extra_end {
        let header_end = position
            .checked_add(extra_header.len() as u64)
            .ok_or_else(|| "A ZIP extra field header offset overflows the JAR.".to_string())?;
        if header_end > extra_end {
            return Err("A ZIP extra field header is truncated.".to_string());
        }

        file.seek(SeekFrom::Start(position))
            .map_err(|error| format!("Failed to seek to a ZIP extra field: {error}"))?;
        file.read_exact(&mut extra_header)
            .map_err(|error| format!("Failed to read a ZIP extra field header: {error}"))?;
        let field_id = little_endian_u16(&extra_header, 0)
            .ok_or_else(|| "A ZIP extra field ID is missing.".to_string())?;
        let field_size = little_endian_u16(&extra_header, 2)
            .ok_or_else(|| "A ZIP extra field size is missing.".to_string())?
            as u64;
        let data_offset = header_end;
        let field_end = data_offset
            .checked_add(field_size)
            .ok_or_else(|| "A ZIP extra field size overflows the JAR.".to_string())?;
        if field_end > extra_end {
            return Err("A ZIP extra field is truncated.".to_string());
        }

        if field_id == ZIP64_EXTRA_FIELD_ID {
            let required_size = usize::from(needs_disk_start) * 4
                + (usize::from(needs_uncompressed_size)
                    + usize::from(needs_compressed_size)
                    + usize::from(needs_local_header_offset))
                    * 8;
            if field_size
                < u64::try_from(required_size)
                    .map_err(|_| "The ZIP64 extra field size overflows.".to_string())?
            {
                return Err("The ZIP64 extra field is missing required values.".to_string());
            }

            let mut values = [0_u8; 28];
            file.seek(SeekFrom::Start(data_offset))
                .map_err(|error| format!("Failed to seek to the ZIP64 extra field: {error}"))?;
            file.read_exact(&mut values[..required_size])
                .map_err(|error| format!("Failed to read the ZIP64 extra field: {error}"))?;

            let mut cursor = 0;
            let uncompressed_size = if needs_uncompressed_size {
                let value = little_endian_u64(&values, cursor)
                    .ok_or_else(|| "The ZIP64 uncompressed size is missing.".to_string())?;
                cursor += 8;
                value
            } else {
                uncompressed_size_32 as u64
            };
            let compressed_size = if needs_compressed_size {
                let value = little_endian_u64(&values, cursor)
                    .ok_or_else(|| "The ZIP64 compressed size is missing.".to_string())?;
                cursor += 8;
                value
            } else {
                compressed_size_32 as u64
            };
            let local_header_offset = if needs_local_header_offset {
                let value = little_endian_u64(&values, cursor)
                    .ok_or_else(|| "The ZIP64 local header offset is missing.".to_string())?;
                cursor += 8;
                value
            } else {
                local_header_offset_32 as u64
            };
            let disk_start = if needs_disk_start {
                little_endian_u32(&values, cursor)
                    .ok_or_else(|| "The ZIP64 disk start is missing.".to_string())?
            } else {
                disk_start_16 as u32
            };
            if disk_start != 0 {
                return Err("Multi-disk ZIP entries are not supported.".to_string());
            }

            return Ok((compressed_size, uncompressed_size, local_header_offset));
        }

        position = field_end;
    }

    Err("The central directory entry is missing its ZIP64 extra field.".to_string())
}

fn collect_central_directory_entries(
    file: &mut File,
    summary: &ZipDirectorySummary,
) -> Result<[Option<ZipTargetRecord>; ZIP_TARGET_PATHS.len()], String> {
    if summary.offset > summary.end_structure_offset {
        return Err("The ZIP directory starts after its end structure.".to_string());
    }

    let declared_end = summary
        .offset
        .checked_add(summary.declared_size)
        .ok_or_else(|| "The declared ZIP directory range overflows the JAR.".to_string())?;
    if declared_end > summary.end_structure_offset {
        return Err("The declared ZIP directory overlaps its end structure.".to_string());
    }

    let mut position = summary.offset;
    let mut actual_size = 0_u64;
    let mut header = [0_u8; ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as usize];
    let mut targets = std::array::from_fn(|_| None);

    for index in 0..summary.entry_count {
        let header_end = position
            .checked_add(ZIP_CENTRAL_DIRECTORY_HEADER_SIZE)
            .ok_or_else(|| "A ZIP directory header offset overflows the JAR.".to_string())?;
        if header_end > summary.end_structure_offset {
            return Err(format!(
                "ZIP directory entry {} crosses into the ZIP end structure.",
                index + 1
            ));
        }

        file.seek(SeekFrom::Start(position)).map_err(|error| {
            format!(
                "Failed to seek to ZIP directory entry {}: {error}",
                index + 1
            )
        })?;
        file.read_exact(&mut header).map_err(|error| {
            format!("Failed to read ZIP directory entry {}: {error}", index + 1)
        })?;
        if header.get(0..4) != Some(b"PK\x01\x02") {
            return Err(format!(
                "ZIP directory entry {} has an invalid central directory signature.",
                index + 1
            ));
        }

        let filename_length = little_endian_u16(&header, 28)
            .ok_or_else(|| "The ZIP directory filename length is missing.".to_string())?
            as u64;
        let extra_length = little_endian_u16(&header, 30)
            .ok_or_else(|| "The ZIP directory extra length is missing.".to_string())?
            as u64;
        let comment_length = little_endian_u16(&header, 32)
            .ok_or_else(|| "The ZIP directory comment length is missing.".to_string())?
            as u64;
        let entry_size = ZIP_CENTRAL_DIRECTORY_HEADER_SIZE
            .checked_add(filename_length)
            .and_then(|size| size.checked_add(extra_length))
            .and_then(|size| size.checked_add(comment_length))
            .ok_or_else(|| "A ZIP directory entry size overflows the JAR.".to_string())?;
        actual_size = actual_size
            .checked_add(entry_size)
            .ok_or_else(|| "The actual ZIP directory size overflows the JAR.".to_string())?;
        if actual_size > MAX_ZIP_CENTRAL_DIRECTORY_SIZE {
            return Err(format!(
                "The actual JAR ZIP directory exceeds the {MAX_ZIP_CENTRAL_DIRECTORY_SIZE}-byte inspection limit."
            ));
        }

        let entry_end = position
            .checked_add(entry_size)
            .ok_or_else(|| "A ZIP directory entry offset overflows the JAR.".to_string())?;
        if entry_end > summary.end_structure_offset {
            return Err(format!(
                "ZIP directory entry {} crosses into the ZIP end structure.",
                index + 1
            ));
        }

        let filename_length_usize = usize::try_from(filename_length)
            .map_err(|_| "A ZIP directory filename length is too large.".to_string())?;
        let could_be_target = filename_length_usize <= ZIP_TARGET_PATH_BUFFER_SIZE
            && ZIP_TARGET_PATHS
                .iter()
                .any(|target| target.len() == filename_length_usize);
        if could_be_target {
            let mut filename = [0_u8; ZIP_TARGET_PATH_BUFFER_SIZE];
            file.seek(SeekFrom::Start(header_end))
                .map_err(|error| format!("Failed to seek to a ZIP filename: {error}"))?;
            file.read_exact(&mut filename[..filename_length_usize])
                .map_err(|error| format!("Failed to read a ZIP filename: {error}"))?;

            if let Some(target_index) = zip_target_path_index(&filename[..filename_length_usize]) {
                if targets[target_index].is_some() {
                    targets[target_index] = Some(ZipTargetRecord::Invalid(format!(
                        "The ZIP contains ambiguous duplicate '{}' entries.",
                        ZIP_TARGET_PATHS[target_index]
                    )));
                } else {
                    let flags = little_endian_u16(&header, 8)
                        .ok_or_else(|| "The ZIP entry flags are missing.".to_string())?;
                    let compression_method = little_endian_u16(&header, 10)
                        .ok_or_else(|| "The ZIP compression method is missing.".to_string())?;
                    let compressed_size = little_endian_u32(&header, 20)
                        .ok_or_else(|| "The ZIP compressed size is missing.".to_string())?;
                    let uncompressed_size = little_endian_u32(&header, 24)
                        .ok_or_else(|| "The ZIP uncompressed size is missing.".to_string())?;
                    let disk_start = little_endian_u16(&header, 34)
                        .ok_or_else(|| "The ZIP disk start is missing.".to_string())?;
                    let local_header_offset = little_endian_u32(&header, 42)
                        .ok_or_else(|| "The ZIP local header offset is missing.".to_string())?;
                    let extra_offset = header_end
                        .checked_add(filename_length)
                        .ok_or_else(|| "The ZIP extra field offset overflows.".to_string())?;
                    targets[target_index] = Some(
                        match read_zip64_target_entry(
                            file,
                            extra_offset,
                            extra_length,
                            compressed_size,
                            uncompressed_size,
                            local_header_offset,
                            disk_start,
                        ) {
                            Ok((compressed_size, uncompressed_size, local_header_offset)) => {
                                ZipTargetRecord::Entry(ZipTargetEntry {
                                    flags,
                                    compression_method,
                                    compressed_size,
                                    uncompressed_size,
                                    local_header_offset,
                                })
                            }
                            Err(error) => ZipTargetRecord::Invalid(error),
                        },
                    );
                }
            }
        }

        position = entry_end;
    }

    if actual_size > summary.declared_size {
        return Err(format!(
            "The actual ZIP directory entries occupy {actual_size} bytes, exceeding the declared size of {} bytes.",
            summary.declared_size
        ));
    }

    Ok(targets)
}

fn inspect_zip_archive(file: &mut File) -> Result<InspectedZipArchive, String> {
    let summary = zip_directory_summary(file)?;
    if summary.entry_count > MAX_ZIP_ENTRIES {
        return Err(format!(
            "The JAR contains {} ZIP entries; the inspection limit is {MAX_ZIP_ENTRIES}.",
            summary.entry_count
        ));
    }
    if summary.declared_size > MAX_ZIP_CENTRAL_DIRECTORY_SIZE {
        return Err(format!(
            "The declared JAR ZIP directory is {} bytes; the inspection limit is {MAX_ZIP_CENTRAL_DIRECTORY_SIZE} bytes.",
            summary.declared_size
        ));
    }
    let targets = collect_central_directory_entries(file, &summary)?;
    Ok(InspectedZipArchive {
        directory: summary,
        targets,
    })
}

#[cfg(test)]
fn preflight_zip_archive(file: &mut File) -> Result<(), String> {
    inspect_zip_archive(file).map(|_| ())
}

fn read_metadata_stream(reader: impl Read, expected_size: u64) -> Result<Vec<u8>, String> {
    let capacity = usize::try_from(expected_size)
        .map_err(|_| "The metadata output size is too large.".to_string())?;
    let mut bytes = Vec::with_capacity(capacity);
    reader
        .take(MAX_METADATA_FILE_SIZE + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Failed to read the metadata stream: {error}"))?;
    if bytes.len() as u64 > MAX_METADATA_FILE_SIZE {
        return Err(format!(
            "The decompressed entry exceeds the {MAX_METADATA_FILE_SIZE}-byte inspection limit."
        ));
    }
    if bytes.len() as u64 != expected_size {
        return Err(format!(
            "The metadata stream contains {} bytes, but the central directory declares {expected_size} bytes.",
            bytes.len()
        ));
    }
    Ok(bytes)
}

fn read_archive_text(
    file: &mut File,
    archive: &InspectedZipArchive,
    source: &str,
) -> Result<Option<String>, String> {
    let target_index = ZIP_TARGET_PATHS
        .iter()
        .position(|target| *target == source)
        .ok_or_else(|| "The requested ZIP metadata path is not inspected.".to_string())?;
    let Some(record) = archive.targets[target_index].as_ref() else {
        return Ok(None);
    };
    let entry = match record {
        ZipTargetRecord::Entry(entry) => entry,
        ZipTargetRecord::Invalid(error) => return Err(error.clone()),
    };
    if entry.uncompressed_size > MAX_METADATA_FILE_SIZE {
        return Err(format!(
            "The entry is too large to inspect ({} bytes; limit is {MAX_METADATA_FILE_SIZE} bytes).",
            entry.uncompressed_size
        ));
    }
    if entry.compressed_size > MAX_METADATA_COMPRESSED_SIZE {
        return Err(format!(
            "The compressed entry is too large to inspect ({} bytes; limit is {MAX_METADATA_COMPRESSED_SIZE} bytes).",
            entry.compressed_size
        ));
    }
    if entry.flags & ZIP_ENCRYPTION_FLAGS != 0 {
        return Err("Encrypted ZIP metadata entries are not supported.".to_string());
    }
    if !matches!(entry.compression_method, 0 | 8) {
        return Err(format!(
            "ZIP compression method {} is not supported for metadata inspection.",
            entry.compression_method
        ));
    }

    let local_header_end = entry
        .local_header_offset
        .checked_add(ZIP_LOCAL_FILE_HEADER_SIZE)
        .ok_or_else(|| "The ZIP local header offset overflows the JAR.".to_string())?;
    if local_header_end > archive.directory.offset {
        return Err("The ZIP local header crosses into the central directory.".to_string());
    }
    file.seek(SeekFrom::Start(entry.local_header_offset))
        .map_err(|error| format!("Failed to seek to the ZIP local header: {error}"))?;
    let mut local_header = [0_u8; ZIP_LOCAL_FILE_HEADER_SIZE as usize];
    file.read_exact(&mut local_header)
        .map_err(|error| format!("Failed to read the ZIP local header: {error}"))?;
    if local_header.get(0..4) != Some(b"PK\x03\x04") {
        return Err("The ZIP local file header signature is invalid.".to_string());
    }
    let local_flags = little_endian_u16(&local_header, 6)
        .ok_or_else(|| "The ZIP local entry flags are missing.".to_string())?;
    if local_flags & ZIP_ENCRYPTION_FLAGS != 0 {
        return Err("Encrypted ZIP metadata entries are not supported.".to_string());
    }
    let local_compression_method = little_endian_u16(&local_header, 8)
        .ok_or_else(|| "The ZIP local compression method is missing.".to_string())?;
    if local_compression_method != entry.compression_method {
        return Err(
            "The ZIP local and central directory compression methods do not match.".to_string(),
        );
    }
    let local_filename_length = little_endian_u16(&local_header, 26)
        .ok_or_else(|| "The ZIP local filename length is missing.".to_string())?
        as u64;
    let local_extra_length = little_endian_u16(&local_header, 28)
        .ok_or_else(|| "The ZIP local extra length is missing.".to_string())?
        as u64;
    if local_filename_length != source.len() as u64 {
        return Err("The ZIP local and central directory filenames do not match.".to_string());
    }

    let data_offset = local_header_end
        .checked_add(local_filename_length)
        .and_then(|offset| offset.checked_add(local_extra_length))
        .ok_or_else(|| "The ZIP metadata data offset overflows the JAR.".to_string())?;
    let data_end = data_offset
        .checked_add(entry.compressed_size)
        .ok_or_else(|| "The ZIP metadata data range overflows the JAR.".to_string())?;
    if data_offset > archive.directory.offset || data_end > archive.directory.offset {
        return Err("The ZIP metadata data crosses into the central directory.".to_string());
    }

    let mut local_filename = [0_u8; ZIP_TARGET_PATH_BUFFER_SIZE];
    file.read_exact(&mut local_filename[..source.len()])
        .map_err(|error| format!("Failed to read the ZIP local filename: {error}"))?;
    if &local_filename[..source.len()] != source.as_bytes() {
        return Err("The ZIP local and central directory filenames do not match.".to_string());
    }

    file.seek(SeekFrom::Start(data_offset))
        .map_err(|error| format!("Failed to seek to ZIP metadata data: {error}"))?;
    let bytes = match entry.compression_method {
        0 => {
            if entry.compressed_size != entry.uncompressed_size {
                return Err(
                    "A stored ZIP metadata entry has inconsistent compressed and uncompressed sizes."
                        .to_string(),
                );
            }
            let reader = (&mut *file).take(entry.compressed_size);
            read_metadata_stream(reader, entry.uncompressed_size)?
        }
        8 => {
            let reader = (&mut *file).take(entry.compressed_size);
            read_metadata_stream(DeflateDecoder::new(reader), entry.uncompressed_size)?
        }
        _ => unreachable!(),
    };

    if bytes.len() as u64 > MAX_METADATA_FILE_SIZE {
        return Err(format!(
            "The decompressed entry exceeds the {MAX_METADATA_FILE_SIZE}-byte inspection limit."
        ));
    }

    String::from_utf8(bytes)
        .map(Some)
        .map_err(|error| format!("The entry is not valid UTF-8: {error}"))
}

fn manifest_implementation_version(text: &str) -> Option<String> {
    let mut fields = Vec::new();
    let mut current = String::new();

    for line in text.replace("\r\n", "\n").lines() {
        if let Some(continuation) = line.strip_prefix(' ') {
            current.push_str(continuation);
        } else {
            if !current.is_empty() {
                fields.push(std::mem::take(&mut current));
            }
            current.push_str(line);
        }
    }
    if !current.is_empty() {
        fields.push(current);
    }

    fields.into_iter().find_map(|field| {
        let (key, value) = field.split_once(':')?;
        if key.trim().eq_ignore_ascii_case("Implementation-Version") {
            non_empty_string(value)
        } else {
            None
        }
    })
}

fn push_metadata_diagnostic(metadata: &mut LocalModMetadata, diagnostic: String) {
    if metadata.diagnostics.len() < MAX_METADATA_DIAGNOSTICS {
        metadata.diagnostics.push(diagnostic);
    }
}

fn append_metadata_entries(
    metadata: &mut LocalModMetadata,
    source: &str,
    mut entries: Vec<LocalModMetadataEntry>,
) {
    if entries.len() > MAX_METADATA_ENTRIES_PER_DESCRIPTOR {
        push_metadata_diagnostic(
            metadata,
            format!(
                "{source}: metadata entries were truncated from {} to {}.",
                entries.len(),
                MAX_METADATA_ENTRIES_PER_DESCRIPTOR
            ),
        );
        entries.truncate(MAX_METADATA_ENTRIES_PER_DESCRIPTOR);
    }

    let remaining_entries = MAX_METADATA_ENTRIES_PER_JAR.saturating_sub(metadata.entries.len());
    if entries.len() > remaining_entries {
        push_metadata_diagnostic(
            metadata,
            format!(
                "{source}: metadata entries were truncated to keep the per-JAR limit at {MAX_METADATA_ENTRIES_PER_JAR}."
            ),
        );
        entries.truncate(remaining_entries);
    }

    let mut dependency_count = metadata
        .entries
        .iter()
        .map(|entry| entry.dependencies.len())
        .sum::<usize>();
    let mut jar_dependency_limit_reported = false;
    for entry in &mut entries {
        if entry.authors.len() > MAX_METADATA_PEOPLE_PER_ENTRY {
            push_metadata_diagnostic(
                metadata,
                format!(
                    "{source}: authors/contributors for '{}' were truncated from {} to {}.",
                    entry.mod_id.as_deref().unwrap_or("unknown mod"),
                    entry.authors.len(),
                    MAX_METADATA_PEOPLE_PER_ENTRY
                ),
            );
            entry.authors.truncate(MAX_METADATA_PEOPLE_PER_ENTRY);
        }

        if entry.dependencies.len() > MAX_DEPENDENCIES_PER_ENTRY {
            push_metadata_diagnostic(
                metadata,
                format!(
                    "{source}: dependencies for '{}' were truncated from {} to {}.",
                    entry.mod_id.as_deref().unwrap_or("unknown mod"),
                    entry.dependencies.len(),
                    MAX_DEPENDENCIES_PER_ENTRY
                ),
            );
            entry.dependencies.truncate(MAX_DEPENDENCIES_PER_ENTRY);
        }

        let remaining_dependencies = MAX_DEPENDENCIES_PER_JAR.saturating_sub(dependency_count);
        if entry.dependencies.len() > remaining_dependencies {
            if !jar_dependency_limit_reported {
                push_metadata_diagnostic(
                    metadata,
                    format!(
                        "{source}: dependencies were truncated to keep the per-JAR limit at {MAX_DEPENDENCIES_PER_JAR}."
                    ),
                );
                jar_dependency_limit_reported = true;
            }
            entry.dependencies.truncate(remaining_dependencies);
        }
        dependency_count += entry.dependencies.len();
    }

    let mut serialized_size = 2 + metadata
        .entries
        .iter()
        .filter_map(|entry| serde_json::to_vec(entry).ok())
        .map(|entry| entry.len() + 1)
        .sum::<usize>();
    let mut accepted_entries = Vec::with_capacity(entries.len());
    let mut serialized_limit_reached = false;
    for entry in entries {
        let entry_size = serde_json::to_vec(&entry)
            .map(|entry| entry.len())
            .unwrap_or(MAX_METADATA_SERIALIZED_BYTES_PER_JAR + 1);
        if serialized_size.saturating_add(entry_size + 1) > MAX_METADATA_SERIALIZED_BYTES_PER_JAR {
            serialized_limit_reached = true;
            break;
        }
        serialized_size += entry_size + 1;
        accepted_entries.push(entry);
    }
    if serialized_limit_reached {
        push_metadata_diagnostic(
            metadata,
            format!(
                "{source}: metadata was truncated to keep the per-JAR serialized data limit at {MAX_METADATA_SERIALIZED_BYTES_PER_JAR} bytes."
            ),
        );
    }
    metadata.entries.extend(accepted_entries);
}

fn parse_mod_metadata(path: &Path) -> LocalModMetadata {
    let mut metadata = LocalModMetadata::default();
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) => {
            push_metadata_diagnostic(
                &mut metadata,
                format!("Failed to open the JAR for metadata inspection: {error}"),
            );
            return metadata;
        }
    };
    let archive = match inspect_zip_archive(&mut file) {
        Ok(archive) => archive,
        Err(error) => {
            push_metadata_diagnostic(
                &mut metadata,
                format!("Metadata inspection was skipped: {error}"),
            );
            return metadata;
        }
    };

    let jar_version = match read_archive_text(&mut file, &archive, MANIFEST_PATH) {
        Ok(Some(manifest)) => manifest_implementation_version(&manifest),
        Ok(None) => None,
        Err(error) => {
            push_metadata_diagnostic(&mut metadata, format!("{MANIFEST_PATH}: {error}"));
            None
        }
    };

    let mut found_descriptor = false;
    for source in MOD_DESCRIPTOR_PATHS {
        let text = match read_archive_text(&mut file, &archive, source) {
            Ok(Some(text)) => {
                found_descriptor = true;
                text
            }
            Ok(None) => continue,
            Err(error) => {
                found_descriptor = true;
                push_metadata_diagnostic(&mut metadata, format!("{source}: {error}"));
                continue;
            }
        };

        let parsed = match source {
            "fabric.mod.json" => parse_fabric_metadata(&text, source),
            "quilt.mod.json" => parse_quilt_metadata(&text, source),
            "META-INF/mods.toml" => {
                parse_forge_metadata(&text, source, "Forge / NeoForge", jar_version.as_deref())
            }
            "META-INF/neoforge.mods.toml" => {
                parse_forge_metadata(&text, source, "NeoForge", jar_version.as_deref())
            }
            "mcmod.info" => parse_mcmod_metadata(&text, source),
            _ => unreachable!(),
        };

        match parsed {
            Ok(entries) if entries.is_empty() => push_metadata_diagnostic(
                &mut metadata,
                format!("{source}: no mod entries were found."),
            ),
            Ok(entries) => append_metadata_entries(&mut metadata, source, entries),
            Err(error) => {
                push_metadata_diagnostic(&mut metadata, format!("{source}: {error}"));
            }
        }
    }

    if !found_descriptor {
        push_metadata_diagnostic(
            &mut metadata,
            "No supported mod metadata descriptor was found in the JAR.".to_string(),
        );
    }

    metadata
}

fn local_mod_file(path: &Path, filename: String, enabled: bool) -> Result<LocalModFile, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Failed to read mod file '{}': {}", path.display(), error))?;

    if !metadata.is_file() {
        return Err(format!("Mod path '{}' is not a file.", path.display()));
    }

    Ok(LocalModFile {
        filename,
        enabled,
        size: metadata.len(),
        metadata: parse_mod_metadata(path),
    })
}

fn import_mod(mods_directory: &Path, source_path: &str) -> Result<String, String> {
    if source_path.trim().is_empty() {
        return Err("Source path cannot be empty.".to_string());
    }

    let source = Path::new(source_path);
    let filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Source file has an invalid filename.".to_string())?;
    validate_import_filename(filename)?;

    let source_metadata =
        fs::metadata(source).map_err(|error| format!("Failed to access source file: {}", error))?;
    if !source_metadata.is_file() {
        return Err("Source path is not a regular file.".to_string());
    }

    let destination = mods_directory.join(filename);
    let disabled_destination = mods_directory.join(format!("{filename}{DISABLED_SUFFIX}"));
    if path_exists(&destination)? || path_exists(&disabled_destination)? {
        return Err(format!(
            "A mod named '{filename}' is already installed or disabled."
        ));
    }

    let mut source_file =
        File::open(source).map_err(|error| format!("Failed to open source file: {}", error))?;
    let (temp_path, mut temp_file) = create_import_temp_file(mods_directory)?;

    if let Err(error) = io::copy(&mut source_file, &mut temp_file) {
        drop(temp_file);
        return Err(cleanup_import_failure(
            &temp_path,
            format!("Failed to copy mod file: {error}"),
        ));
    }

    if let Err(error) = temp_file.sync_all() {
        drop(temp_file);
        return Err(cleanup_import_failure(
            &temp_path,
            format!("Failed to finish writing mod file: {error}"),
        ));
    }

    drop(temp_file);
    drop(source_file);

    match path_exists(&disabled_destination) {
        Ok(false) => {}
        Ok(true) => {
            return Err(cleanup_import_failure(
                &temp_path,
                format!("A disabled mod named '{filename}' appeared during the import."),
            ));
        }
        Err(error) => return Err(cleanup_import_failure(&temp_path, error)),
    }

    publish_import_temp(&temp_path, &destination, filename)?;

    Ok(filename.to_string())
}

fn scan_local_mods_blocking(game_directory: &str) -> Result<Vec<LocalModFile>, String> {
    let mods_directory = mods_directory(game_directory)?;
    create_mods_directory(&mods_directory)?;

    let entries = fs::read_dir(&mods_directory).map_err(|error| {
        format!(
            "Failed to read mods directory '{}': {}",
            mods_directory.display(),
            error
        )
    })?;
    let mut mods = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Failed to read an entry in mods directory '{}': {}",
                mods_directory.display(),
                error
            )
        })?;
        let filename = match entry.file_name().into_string() {
            Ok(filename) => filename,
            Err(_) => continue,
        };

        if !is_mod_filename(&filename) {
            continue;
        }

        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect mod file '{filename}': {error}"))?;
        if !file_type.is_file() {
            continue;
        }

        let enabled = is_enabled_mod_filename(&filename);
        mods.push(local_mod_file(&entry.path(), filename, enabled)?);
    }

    mods.sort_by_cached_key(|local_mod| local_mod.filename.to_ascii_lowercase());
    Ok(mods)
}

fn import_local_mods_blocking(
    game_directory: &str,
    source_paths: Vec<String>,
) -> Result<LocalModImportResult, String> {
    let mods_directory = mods_directory(game_directory)?;
    create_mods_directory(&mods_directory)?;

    let mut result = LocalModImportResult {
        imported: Vec::with_capacity(source_paths.len()),
        failed: Vec::new(),
    };

    for source_path in source_paths {
        let display_filename = Path::new(&source_path)
            .file_name()
            .map(|filename| filename.to_string_lossy().into_owned())
            .unwrap_or_else(|| source_path.clone());

        match import_mod(&mods_directory, &source_path) {
            Ok(filename) => result.imported.push(filename),
            Err(reason) => result.failed.push(LocalModImportFailure {
                filename: display_filename,
                reason,
            }),
        }
    }

    Ok(result)
}

fn set_local_mod_enabled_blocking(
    game_directory: &str,
    filename: String,
    enabled: bool,
) -> Result<LocalModFile, String> {
    validate_mod_filename(&filename)?;

    let mods_directory = mods_directory(game_directory)?;
    if !ensure_existing_mods_directory(&mods_directory)? {
        return Err(format!(
            "Mods directory '{}' does not exist.",
            mods_directory.display()
        ));
    }

    let currently_enabled = is_enabled_mod_filename(&filename);
    let source = mods_directory.join(&filename);
    let mut current_mod = local_mod_file(&source, filename.clone(), currently_enabled)?;

    if currently_enabled == enabled {
        return Ok(current_mod);
    }

    let destination_filename = if enabled {
        enabled_filename(&filename)
            .ok_or_else(|| "Disabled mod filename is invalid.".to_string())?
    } else {
        format!("{filename}{DISABLED_SUFFIX}")
    };
    let destination = mods_directory.join(&destination_filename);

    if path_exists(&destination)? {
        return Err(format!(
            "Cannot change mod state because '{}' already exists.",
            destination_filename
        ));
    }

    rename_without_overwrite(&source, &destination).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            format!(
                "Cannot change mod state because '{}' already exists.",
                destination_filename
            )
        } else {
            format!(
                "Failed to {} mod '{}': {}",
                if enabled { "enable" } else { "disable" },
                filename,
                error
            )
        }
    })?;

    current_mod.filename = destination_filename;
    current_mod.enabled = enabled;
    Ok(current_mod)
}

#[tauri::command]
pub async fn scan_local_mods(game_directory: String) -> Result<Vec<LocalModFile>, String> {
    let operation_guard = MODS_OPERATION_LOCK.lock().await;
    tokio::task::spawn_blocking(move || {
        let _operation_guard = operation_guard;
        scan_local_mods_blocking(&game_directory)
    })
    .await
    .map_err(|error| format!("Local mod scan task failed: {error}"))?
}

#[tauri::command]
pub async fn import_local_mods(
    game_directory: String,
    source_paths: Vec<String>,
) -> Result<LocalModImportResult, String> {
    let operation_guard = MODS_OPERATION_LOCK.lock().await;
    tokio::task::spawn_blocking(move || {
        let _operation_guard = operation_guard;
        import_local_mods_blocking(&game_directory, source_paths)
    })
    .await
    .map_err(|error| format!("Local mod import task failed: {error}"))?
}

#[tauri::command]
pub async fn set_local_mod_enabled(
    game_directory: String,
    filename: String,
    enabled: bool,
) -> Result<LocalModFile, String> {
    let operation_guard = MODS_OPERATION_LOCK.lock().await;
    tokio::task::spawn_blocking(move || {
        let _operation_guard = operation_guard;
        set_local_mod_enabled_blocking(&game_directory, filename, enabled)
    })
    .await
    .map_err(|error| format!("Local mod state task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn parses_fabric_metadata() {
        let entries = parse_fabric_metadata(
            r#"{
                "id": "example",
                "version": "1.2.3",
                "name": "Example Mod",
                "authors": ["Alice", {"name": "Bob"}],
                "environment": "*",
                "depends": {
                    "fabricloader": ">=0.16.0",
                    "minecraft": ["1.21", "1.21.1"]
                },
                "suggests": {"optional-api": "*"}
            }"#,
            "fabric.mod.json",
        )
        .expect("Fabric metadata should parse");

        let entry = &entries[0];
        assert_eq!(entry.mod_id.as_deref(), Some("example"));
        assert_eq!(entry.name.as_deref(), Some("Example Mod"));
        assert_eq!(entry.authors, ["Alice", "Bob"]);
        assert_eq!(entry.loader_version.as_deref(), Some(">=0.16.0"));
        assert_eq!(entry.game_version.as_deref(), Some(r#"["1.21","1.21.1"]"#));
        assert_eq!(entry.dependencies.len(), 3);
    }

    #[test]
    fn parses_quilt_metadata_without_dropping_roles_or_complex_constraints() {
        let entries = parse_quilt_metadata(
            r#"{
                "quilt_loader": {
                    "id": "quilt-example",
                    "version": "2.0.0",
                    "metadata": {
                        "name": "Quilt Example",
                        "contributors": {
                            "Alice": ["Owner", "Developer"]
                        }
                    },
                    "depends": [
                        {"id": "quilt_loader", "versions": ">=0.28.0"},
                        {
                            "id": "minecraft",
                            "versions": {"any": [">=1.20", "<1.22"]},
                            "unless": {"id": "compat-layer"},
                            "optional": false
                        }
                    ]
                },
                "minecraft": {"environment": "client"}
            }"#,
            "quilt.mod.json",
        )
        .expect("Quilt metadata should parse");

        let entry = &entries[0];
        assert_eq!(entry.authors, ["Alice (Owner, Developer)"]);
        assert_eq!(entry.loader_version.as_deref(), Some(">=0.28.0"));
        assert_eq!(entry.environment.as_deref(), Some("client"));
        let minecraft = entry
            .dependencies
            .iter()
            .find(|dependency| dependency.mod_id == "minecraft")
            .expect("Minecraft dependency should be present");
        let constraint = minecraft
            .version
            .as_deref()
            .expect("Complex constraint should be retained");
        assert!(constraint.contains(r#""versions""#));
        assert!(constraint.contains(r#""unless""#));
        assert_eq!(minecraft.required, Some(true));
    }

    #[test]
    fn parses_forge_metadata_and_resolves_manifest_version() {
        let entries = parse_forge_metadata(
            r#"
                modLoader = "javafml"
                loaderVersion = "[47,)"

                [[mods]]
                modId = "forge_example"
                version = "${file.jarVersion}"
                displayName = "Forge Example"
                authors = "Alice, Bob"

                [[dependencies.forge_example]]
                modId = "minecraft"
                mandatory = true
                versionRange = "[1.20.1,1.21)"
                ordering = "NONE"
                side = "BOTH"

                [[dependencies.forge_example]]
                modId = "forge"
                mandatory = true
                versionRange = "[47,)"
                ordering = "NONE"
                side = "BOTH"
            "#,
            "META-INF/mods.toml",
            "Forge / NeoForge",
            Some("3.4.5"),
        )
        .expect("Forge metadata should parse");

        let entry = &entries[0];
        assert_eq!(entry.loader, "Forge / NeoForge");
        assert_eq!(entry.version.as_deref(), Some("3.4.5"));
        assert_eq!(entry.loader_version.as_deref(), Some("[47,)"));
        assert_eq!(entry.language_loader.as_deref(), Some("javafml"));
        assert_eq!(entry.language_loader_version.as_deref(), Some("[47,)"));
        assert_eq!(entry.game_version.as_deref(), Some("[1.20.1,1.21)"));
        assert_eq!(entry.dependencies[0].required, Some(true));
        assert_eq!(entry.dependencies[0].side.as_deref(), Some("BOTH"));
        assert_eq!(entry.dependencies[0].ordering.as_deref(), Some("NONE"));
    }

    #[test]
    fn parses_neoforge_dependency_type() {
        let entries = parse_forge_metadata(
            r#"
                modLoader = "javafml"
                loaderVersion = "[1,)"

                [[mods]]
                modId = "neo_example"
                version = "1.0.0"
                displayName = "NeoForge Example"

                [[dependencies.neo_example]]
                modId = "neoforge"
                type = "required"
                versionRange = "[21.1,)"
                side = "BOTH"
            "#,
            "META-INF/neoforge.mods.toml",
            "NeoForge",
            None,
        )
        .expect("NeoForge metadata should parse");

        let dependency = &entries[0].dependencies[0];
        assert_eq!(entries[0].loader_version.as_deref(), Some("[21.1,)"));
        assert_eq!(entries[0].language_loader.as_deref(), Some("javafml"));
        assert_eq!(entries[0].language_loader_version.as_deref(), Some("[1,)"));
        assert_eq!(dependency.relation, "required");
        assert_eq!(dependency.required, Some(true));
        assert_eq!(dependency.version.as_deref(), Some("[21.1,)"));
    }

    #[test]
    fn parses_legacy_mcmod_metadata() {
        let entries = parse_mcmod_metadata(
            r#"[{
                "modid": "legacy_example",
                "name": "Legacy Example",
                "version": "1.0",
                "mcversion": "1.12.2",
                "authorList": ["Alice"],
                "dependencies": [
                    "required-after:Forge@[14.23.5,)",
                    "after:another_mod"
                ]
            }]"#,
            "mcmod.info",
        )
        .expect("mcmod.info should parse");

        let entry = &entries[0];
        assert_eq!(entry.mod_id.as_deref(), Some("legacy_example"));
        assert_eq!(entry.game_version.as_deref(), Some("1.12.2"));
        assert_eq!(entry.loader_version.as_deref(), Some("[14.23.5,)"));
        assert_eq!(entry.dependencies[0].relation, "required-after");
    }

    #[test]
    fn unfolds_manifest_continuations() {
        let manifest = "Manifest-Version: 1.0\r\nImplementation-Version: 1.2.\r\n 3-beta\r\n\r\n";
        assert_eq!(
            manifest_implementation_version(manifest).as_deref(),
            Some("1.2.3-beta")
        );
    }

    #[test]
    fn resolves_zip64_candidate_sizes_and_local_header_offset() {
        let filename = format!(
            "epherome-zip64-extra-{}-{}.bin",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let mut extra = Vec::new();
        extra.extend_from_slice(&ZIP64_EXTRA_FIELD_ID.to_le_bytes());
        extra.extend_from_slice(&24_u16.to_le_bytes());
        extra.extend_from_slice(&12_u64.to_le_bytes());
        extra.extend_from_slice(&10_u64.to_le_bytes());
        extra.extend_from_slice(&7_u64.to_le_bytes());
        fs::write(&path, &extra).expect("Temporary ZIP64 extra field should be written");

        let mut file = File::open(&path).expect("Temporary ZIP64 extra field should open");
        let resolved = read_zip64_target_entry(
            &mut file,
            0,
            extra.len() as u64,
            u32::MAX,
            u32::MAX,
            u32::MAX,
            0,
        )
        .expect("ZIP64 values should resolve");
        let _ = fs::remove_file(path);

        assert_eq!(resolved, (10, 12, 7));
    }

    #[test]
    fn corrupt_jar_returns_a_diagnostic_instead_of_an_error() {
        let filename = format!(
            "epherome-corrupt-mod-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        fs::write(&path, b"not a zip archive").expect("Temporary corrupt JAR should be written");

        let metadata = parse_mod_metadata(&path);
        let _ = fs::remove_file(path);

        assert!(metadata.entries.is_empty());
        assert_eq!(metadata.diagnostics.len(), 1);
        assert!(metadata.diagnostics[0].contains("inspection"));
    }

    #[test]
    fn reads_metadata_from_a_disabled_jar_archive() {
        let filename = format!(
            "epherome-metadata-mod-{}-{}.jar.disabled",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(&filename);
        let file = File::create(&path).expect("Temporary JAR should be created");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("fabric.mod.json", SimpleFileOptions::default())
            .expect("Metadata entry should be created");
        archive
            .write_all(
                br#"{
                    "id": "archive_example",
                    "name": "Archive Example",
                    "version": "1.0.0",
                    "authors": ["Alice"],
                    "depends": {"minecraft": "1.21.1"}
                }"#,
            )
            .expect("Metadata should be written");
        archive.finish().expect("Temporary JAR should be finished");

        let local_mod =
            local_mod_file(&path, filename, false).expect("The disabled JAR should be inspected");
        let _ = fs::remove_file(path);

        assert!(!local_mod.enabled);
        assert!(local_mod.metadata.diagnostics.is_empty());
        assert_eq!(local_mod.metadata.entries.len(), 1);
        assert_eq!(
            local_mod.metadata.entries[0].mod_id.as_deref(),
            Some("archive_example")
        );
    }

    #[test]
    fn reads_metadata_from_a_deflated_jar_archive() {
        let filename = format!(
            "epherome-deflated-metadata-mod-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(&filename);
        let file = File::create(&path).expect("Temporary JAR should be created");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file(
                "fabric.mod.json",
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
            )
            .expect("Deflated metadata entry should be created");
        archive
            .write_all(
                br#"{
                    "id": "deflated_example",
                    "name": "Deflated Example",
                    "version": "1.0.0"
                }"#,
            )
            .expect("Deflated metadata should be written");
        archive.finish().expect("Temporary JAR should be finished");

        let metadata = parse_mod_metadata(&path);
        let _ = fs::remove_file(path);

        assert!(metadata.diagnostics.is_empty());
        assert_eq!(metadata.entries.len(), 1);
        assert_eq!(
            metadata.entries[0].mod_id.as_deref(),
            Some("deflated_example")
        );
    }

    #[test]
    fn duplicate_metadata_paths_are_reported_instead_of_selecting_one() {
        let filename = format!(
            "epherome-duplicate-metadata-mod-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(&filename);
        let entry_name = b"fabric.mod.json";
        let contents = [
            br#"{"id":"first_example","version":"1.0.0"}"#.as_slice(),
            br#"{"id":"second_example","version":"1.0.0"}"#.as_slice(),
        ];
        let mut bytes = Vec::new();
        let mut local_offsets = Vec::new();
        for content in contents {
            let local_offset = u32::try_from(bytes.len()).expect("Fixture local offset should fit");
            local_offsets.push((local_offset, content.len() as u32));
            let mut local_header = [0_u8; ZIP_LOCAL_FILE_HEADER_SIZE as usize];
            local_header[0..4].copy_from_slice(b"PK\x03\x04");
            local_header[4..6].copy_from_slice(&20_u16.to_le_bytes());
            local_header[18..22].copy_from_slice(&(content.len() as u32).to_le_bytes());
            local_header[22..26].copy_from_slice(&(content.len() as u32).to_le_bytes());
            local_header[26..28].copy_from_slice(&(entry_name.len() as u16).to_le_bytes());
            bytes.extend_from_slice(&local_header);
            bytes.extend_from_slice(entry_name);
            bytes.extend_from_slice(content);
        }

        let central_offset = u32::try_from(bytes.len()).expect("Fixture central offset should fit");
        for (local_offset, content_length) in local_offsets {
            let mut central_header = [0_u8; ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as usize];
            central_header[0..4].copy_from_slice(b"PK\x01\x02");
            central_header[4..6].copy_from_slice(&20_u16.to_le_bytes());
            central_header[6..8].copy_from_slice(&20_u16.to_le_bytes());
            central_header[20..24].copy_from_slice(&content_length.to_le_bytes());
            central_header[24..28].copy_from_slice(&content_length.to_le_bytes());
            central_header[28..30].copy_from_slice(&(entry_name.len() as u16).to_le_bytes());
            central_header[42..46].copy_from_slice(&local_offset.to_le_bytes());
            bytes.extend_from_slice(&central_header);
            bytes.extend_from_slice(entry_name);
        }
        let central_size = u32::try_from(bytes.len())
            .expect("Fixture size should fit")
            .checked_sub(central_offset)
            .expect("Fixture central size should not underflow");
        let mut end_record = [0_u8; ZIP_EOCD_MIN_SIZE as usize];
        end_record[0..4].copy_from_slice(b"PK\x05\x06");
        end_record[8..10].copy_from_slice(&2_u16.to_le_bytes());
        end_record[10..12].copy_from_slice(&2_u16.to_le_bytes());
        end_record[12..16].copy_from_slice(&central_size.to_le_bytes());
        end_record[16..20].copy_from_slice(&central_offset.to_le_bytes());
        bytes.extend_from_slice(&end_record);
        fs::write(&path, bytes).expect("Duplicate metadata fixture should be written");

        let metadata = parse_mod_metadata(&path);
        let _ = fs::remove_file(path);

        assert!(metadata.entries.is_empty());
        assert_eq!(metadata.diagnostics.len(), 1);
        assert!(metadata.diagnostics[0].contains("ambiguous duplicate 'fabric.mod.json' entries"));
    }

    #[test]
    fn trailing_fake_eocd_does_not_fallback_to_an_earlier_large_descriptor() {
        let filename = format!(
            "epherome-fake-eocd-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let file = File::create(&path).expect("Temporary JAR should be created");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("fabric.mod.json", SimpleFileOptions::default())
            .expect("Earlier metadata entry should be created");
        let oversized_metadata = vec![b' '; MAX_METADATA_FILE_SIZE as usize + 1];
        archive
            .write_all(&oversized_metadata)
            .expect("Earlier oversized metadata should be written");
        archive.finish().expect("Earlier ZIP should be finished");

        let mut fake_end_record = [0_u8; ZIP_EOCD_MIN_SIZE as usize];
        fake_end_record[0..4].copy_from_slice(b"PK\x05\x06");
        fake_end_record[8..10].copy_from_slice(&1_u16.to_le_bytes());
        fake_end_record[12..16].copy_from_slice(&1_u32.to_le_bytes());
        fake_end_record[16..20].copy_from_slice(&0_u32.to_le_bytes());
        let mut file = OpenOptions::new()
            .append(true)
            .open(&path)
            .expect("Temporary JAR should reopen for the fake end record");
        file.write_all(&fake_end_record)
            .expect("Fake trailing end record should be written");
        drop(file);

        let metadata = parse_mod_metadata(&path);
        let _ = fs::remove_file(path);

        assert!(metadata.entries.is_empty());
        assert_eq!(
            metadata.diagnostics,
            ["No supported mod metadata descriptor was found in the JAR."]
        );
    }

    #[test]
    fn zip64_offset_sentinel_uses_the_zip64_limits() {
        let filename = format!(
            "epherome-zip64-preflight-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let mut bytes = vec![0; 98];

        bytes[0..4].copy_from_slice(b"PK\x06\x06");
        bytes[4..12].copy_from_slice(&44_u64.to_le_bytes());
        bytes[32..40].copy_from_slice(&(MAX_ZIP_ENTRIES + 1).to_le_bytes());
        bytes[40..48].copy_from_slice(&(MAX_ZIP_CENTRAL_DIRECTORY_SIZE + 1).to_le_bytes());

        bytes[56..60].copy_from_slice(b"PK\x06\x07");
        bytes[64..72].copy_from_slice(&0_u64.to_le_bytes());

        bytes[76..80].copy_from_slice(b"PK\x05\x06");
        bytes[84..86].copy_from_slice(&1_u16.to_le_bytes());
        bytes[86..88].copy_from_slice(&1_u16.to_le_bytes());
        bytes[88..92].copy_from_slice(&1_u32.to_le_bytes());
        bytes[92..96].copy_from_slice(&u32::MAX.to_le_bytes());

        fs::write(&path, bytes).expect("Temporary ZIP64 fixture should be written");
        let mut file = File::open(&path).expect("Temporary ZIP64 fixture should open");
        let result = preflight_zip_archive(&mut file);
        let _ = fs::remove_file(path);

        assert!(result.is_err());
        assert!(result
            .expect_err("ZIP64 fixture should exceed the limits")
            .contains("ZIP entries"));
    }

    #[test]
    fn actual_central_directory_size_cannot_hide_behind_a_small_declared_size() {
        let filename = format!(
            "epherome-actual-central-directory-limit-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let mut file = File::create(&path).expect("Temporary ZIP fixture should be created");
        let filename_length = u16::MAX;
        let entry_size = ZIP_CENTRAL_DIRECTORY_HEADER_SIZE + filename_length as u64;
        let entry_count = MAX_ZIP_CENTRAL_DIRECTORY_SIZE / entry_size + 1;
        let entry_count_u16 =
            u16::try_from(entry_count).expect("Fixture entry count should fit a classic ZIP");
        let mut header = [0_u8; ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as usize];
        header[0..4].copy_from_slice(b"PK\x01\x02");
        header[28..30].copy_from_slice(&filename_length.to_le_bytes());

        let mut position = 0_u64;
        for _ in 0..entry_count {
            file.seek(SeekFrom::Start(position))
                .expect("Fixture central directory seek should succeed");
            file.write_all(&header)
                .expect("Fixture central directory header should be written");
            position = position
                .checked_add(entry_size)
                .expect("Fixture central directory size should not overflow");
        }

        let mut end_record = [0_u8; ZIP_EOCD_MIN_SIZE as usize];
        end_record[0..4].copy_from_slice(b"PK\x05\x06");
        end_record[8..10].copy_from_slice(&entry_count_u16.to_le_bytes());
        end_record[10..12].copy_from_slice(&entry_count_u16.to_le_bytes());
        end_record[12..16]
            .copy_from_slice(&(ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as u32).to_le_bytes());
        end_record[16..20].copy_from_slice(&0_u32.to_le_bytes());
        file.seek(SeekFrom::Start(position))
            .expect("Fixture end record seek should succeed");
        file.write_all(&end_record)
            .expect("Fixture end record should be written");
        drop(file);

        let mut file = File::open(&path).expect("Temporary ZIP fixture should open");
        let result = preflight_zip_archive(&mut file);
        let _ = fs::remove_file(path);

        let error = result.expect_err("The actual central directory should exceed the limit");
        assert!(error.contains("actual JAR ZIP directory"));
        assert!(error.contains("inspection limit"));
    }

    #[test]
    fn central_directory_entry_cannot_cross_the_classic_end_record() {
        let filename = format!(
            "epherome-central-directory-boundary-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let mut bytes =
            vec![0_u8; (ZIP_CENTRAL_DIRECTORY_HEADER_SIZE + ZIP_EOCD_MIN_SIZE) as usize];
        bytes[0..4].copy_from_slice(b"PK\x01\x02");
        bytes[28..30].copy_from_slice(&1_u16.to_le_bytes());
        let end_record_offset = ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as usize;
        bytes[end_record_offset..end_record_offset + 4].copy_from_slice(b"PK\x05\x06");
        bytes[end_record_offset + 8..end_record_offset + 10].copy_from_slice(&1_u16.to_le_bytes());
        bytes[end_record_offset + 10..end_record_offset + 12].copy_from_slice(&1_u16.to_le_bytes());
        bytes[end_record_offset + 12..end_record_offset + 16]
            .copy_from_slice(&(ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as u32).to_le_bytes());
        bytes[end_record_offset + 16..end_record_offset + 20].copy_from_slice(&0_u32.to_le_bytes());
        fs::write(&path, bytes).expect("Temporary ZIP fixture should be written");

        let mut file = File::open(&path).expect("Temporary ZIP fixture should open");
        let result = preflight_zip_archive(&mut file);
        let _ = fs::remove_file(path);

        assert!(result
            .expect_err("The central directory entry should cross the classic end record")
            .contains("crosses into the ZIP end structure"));
    }

    #[test]
    fn zip64_central_directory_uses_its_own_offset_and_end_record_boundary() {
        let filename = format!(
            "epherome-zip64-central-directory-boundary-{}-{}.jar",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(filename);
        let zip64_end_offset = ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as usize;
        let locator_offset = zip64_end_offset + 56;
        let end_record_offset = locator_offset + 20;
        let mut bytes = vec![0_u8; end_record_offset + ZIP_EOCD_MIN_SIZE as usize];

        bytes[0..4].copy_from_slice(b"PK\x01\x02");
        bytes[28..30].copy_from_slice(&1_u16.to_le_bytes());

        bytes[zip64_end_offset..zip64_end_offset + 4].copy_from_slice(b"PK\x06\x06");
        bytes[zip64_end_offset + 4..zip64_end_offset + 12].copy_from_slice(&44_u64.to_le_bytes());
        bytes[zip64_end_offset + 24..zip64_end_offset + 32].copy_from_slice(&1_u64.to_le_bytes());
        bytes[zip64_end_offset + 32..zip64_end_offset + 40].copy_from_slice(&1_u64.to_le_bytes());
        bytes[zip64_end_offset + 40..zip64_end_offset + 48]
            .copy_from_slice(&ZIP_CENTRAL_DIRECTORY_HEADER_SIZE.to_le_bytes());
        bytes[zip64_end_offset + 48..zip64_end_offset + 56].copy_from_slice(&0_u64.to_le_bytes());

        bytes[locator_offset..locator_offset + 4].copy_from_slice(b"PK\x06\x07");
        bytes[locator_offset + 8..locator_offset + 16]
            .copy_from_slice(&(zip64_end_offset as u64).to_le_bytes());

        bytes[end_record_offset..end_record_offset + 4].copy_from_slice(b"PK\x05\x06");
        bytes[end_record_offset + 8..end_record_offset + 10].copy_from_slice(&1_u16.to_le_bytes());
        bytes[end_record_offset + 10..end_record_offset + 12].copy_from_slice(&1_u16.to_le_bytes());
        bytes[end_record_offset + 12..end_record_offset + 16]
            .copy_from_slice(&(ZIP_CENTRAL_DIRECTORY_HEADER_SIZE as u32).to_le_bytes());
        bytes[end_record_offset + 16..end_record_offset + 20]
            .copy_from_slice(&u32::MAX.to_le_bytes());
        fs::write(&path, bytes).expect("Temporary ZIP64 fixture should be written");

        let mut file = File::open(&path).expect("Temporary ZIP64 fixture should open");
        let result = preflight_zip_archive(&mut file);
        let _ = fs::remove_file(path);

        assert!(result
            .expect_err("The central directory entry should cross the ZIP64 end record")
            .contains("crosses into the ZIP end structure"));
    }

    #[test]
    fn bounds_repeated_forge_metadata_text_before_ipc() {
        let mods = (0..MAX_METADATA_ENTRIES_PER_DESCRIPTOR)
            .map(|_| {
                r#"
                    [[mods]]
                    modId = "same_id"
                    version = "1.0.0"
                    displayName = "Repeated Mod"
                "#
            })
            .collect::<String>();
        let long_version = "x".repeat(MAX_METADATA_FIELD_BYTES * 2);
        let text = format!(
            r#"
                modLoader = "javafml"
                loaderVersion = "[1,)"
                {mods}

                [[dependencies.same_id]]
                modId = "neoforge"
                type = "required"
                versionRange = "{long_version}"
            "#
        );
        let entries = parse_forge_metadata(&text, "META-INF/neoforge.mods.toml", "NeoForge", None)
            .expect("Repeated Forge metadata should parse");

        assert!(entries.iter().all(|entry| {
            entry.dependencies[0]
                .version
                .as_deref()
                .is_some_and(|version| version.len() <= MAX_METADATA_FIELD_BYTES)
        }));

        let mut metadata = LocalModMetadata::default();
        append_metadata_entries(&mut metadata, "META-INF/neoforge.mods.toml", entries);
        let serialized = serde_json::to_vec(&metadata.entries).expect("Metadata should serialize");

        assert!(serialized.len() <= MAX_METADATA_SERIALIZED_BYTES_PER_JAR);
        assert!(metadata
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.contains("serialized data limit")));
    }
}
