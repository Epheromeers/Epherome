import { invoke } from "@tauri-apps/api/core";

export interface LocalModDependency {
  relation: string;
  modId: string;
  version?: string;
  required?: boolean;
  side?: string;
  ordering?: string;
}

export interface LocalModMetadataEntry {
  source: string;
  loader: string;
  name?: string;
  version?: string;
  authors: string[];
  modId?: string;
  loaderVersion?: string;
  languageLoader?: string;
  languageLoaderVersion?: string;
  gameVersion?: string;
  environment?: string;
  dependencies: LocalModDependency[];
}

export interface LocalModMetadata {
  entries: LocalModMetadataEntry[];
  diagnostics: string[];
}

export interface LocalModFile {
  filename: string;
  enabled: boolean;
  size: number;
  metadata: LocalModMetadata;
}

export interface LocalModImportFailure {
  filename: string;
  reason: string;
}

export interface LocalModImportResult {
  imported: string[];
  failed: LocalModImportFailure[];
}

export async function scanLocalMods(
  gameDirectory: string,
): Promise<LocalModFile[]> {
  return await invoke("scan_local_mods", { gameDirectory });
}

export async function importLocalMods(
  gameDirectory: string,
  sourcePaths: string[],
): Promise<LocalModImportResult> {
  return await invoke("import_local_mods", { gameDirectory, sourcePaths });
}

export async function setLocalModEnabled(
  gameDirectory: string,
  filename: string,
  enabled: boolean,
): Promise<LocalModFile> {
  return await invoke("set_local_mod_enabled", {
    gameDirectory,
    filename,
    enabled,
  });
}
