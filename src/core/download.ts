import { path } from "@tauri-apps/api";
import { exists, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

type MinecraftVersionType = "release" | "snapshot" | "old_alpha" | "old_beta";

interface MinecraftVersion {
  id: string;
  type: MinecraftVersionType;
  url: string;
  time: string;
  releaseTime: string;
}

export interface MinecraftVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export async function downloadFile(
  url: string,
  destination: string,
): Promise<void> {
  const result = await fetch(url, { method: "GET" });
  const resultBytes = await result.bytes();
  await mkdir(await path.dirname(destination), { recursive: true });
  await writeFile(destination, resultBytes);
}

export async function installMinecraft(ver: MinecraftVersion, gameDir: string) {
  if (!(await exists(gameDir))) {
    throw new Error(`Game directory ${gameDir} does not exist.`);
  }
  const versionDir = await path.join(gameDir, "versions", ver.id);
  await mkdir(versionDir, { recursive: true });
  const versionJsonPath = await path.join(versionDir, `${ver.id}.json`);

  // Download version JSON
  await downloadFile(ver.url, versionJsonPath);
}

export async function checkHash(
  filePath: string,
  hash: string,
): Promise<boolean> {
  const buffer = await readFile(filePath);
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHash === hash;
}
