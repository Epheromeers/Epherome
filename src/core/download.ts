import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

export async function downloadFile(
  url: string,
  destination: string,
): Promise<void> {
  const result = await fetch(url, { method: "GET" });
  const resultBytes = await result.bytes();
  await writeFile(destination, resultBytes);
}
