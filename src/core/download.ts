import { path } from "@tauri-apps/api";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

export async function downloadFile(
  url: string,
  destination: string,
): Promise<void> {
  const result = await fetch(url, { method: "GET" });
  const resultBytes = await result.bytes();
  await mkdir(await path.dirname(destination), { recursive: true });
  await writeFile(destination, resultBytes);
}
