import { path } from "@tauri-apps/api";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
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
  const versionDir = await path.join(gameDir, "versions", ver.id);
  await mkdir(versionDir, { recursive: true });
  const versionJsonPath = await path.join(versionDir, `${ver.id}.json`);

  // Download version JSON
  await downloadFile(ver.url, versionJsonPath);
}
