import { invoke } from "@tauri-apps/api/core";

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

export async function readDir(pathname: string): Promise<string[]> {
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
