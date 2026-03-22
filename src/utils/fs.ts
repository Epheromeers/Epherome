import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileCheckRequest {
  pathname: string;
  expectedSha1?: string;
}

export interface FileCheckResult {
  pathname: string;
  exists: boolean;
  hashMatched?: boolean;
  error?: string;
}

export interface FileInspectRequest {
  pathname: string;
}

export interface FileInspectResult {
  pathname: string;
  exists: boolean;
  size?: string;
  modifiedMs?: string;
  error?: string;
}

export async function readTextFile(pathname: string): Promise<string> {
  return await invoke("read_text_file", { pathname });
}

export async function writeTextFile(
  pathname: string,
  contents: string,
): Promise<void> {
  return await invoke("write_text_file", { pathname, contents });
}

export async function exists(pathname: string): Promise<boolean> {
  return await invoke("exists", { pathname });
}

export async function mkdir(pathname: string): Promise<void> {
  return await invoke("mkdir", { pathname });
}

export async function readDir(pathname: string): Promise<DirEntry[]> {
  return await invoke("read_dir", { pathname });
}

export async function readFile(pathname: string): Promise<Uint8Array> {
  const data = await invoke<number[]>("read_file", { pathname });
  return new Uint8Array(data);
}

export async function writeFile(
  pathname: string,
  contents: Uint8Array,
): Promise<void> {
  return await invoke("write_file", {
    pathname,
    contents: Array.from(contents),
  });
}

export async function sha1File(pathname: string): Promise<string> {
  return await invoke("sha1_file", { pathname });
}

export async function checkFiles(
  requests: FileCheckRequest[],
): Promise<FileCheckResult[]> {
  return await invoke("check_files", { requests });
}

export async function inspectFiles(
  requests: FileInspectRequest[],
): Promise<FileInspectResult[]> {
  return await invoke("inspect_files", { requests });
}
