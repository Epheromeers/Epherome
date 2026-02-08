import { path } from "@tauri-apps/api";
import type { MinecraftInstance } from "../store/data";
import {
  exists,
  mkdir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
} from "../utils/fs";
import { fetch } from "../utils/http";

type MinecraftVersionType = "release" | "snapshot" | "old_alpha" | "old_beta";

export interface MinecraftVersion {
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
  const result = await fetch(url, { method: "GET", response_type: "bytes" });
  const resultBytes = new Uint8Array(result.bytes || []);
  await mkdir(await path.dirname(destination));
  await writeFile(destination, resultBytes);
}

export async function installMinecraft(ver: MinecraftVersion, gameDir: string) {
  if (!(await exists(gameDir))) {
    throw new Error(`Game directory ${gameDir} does not exist.`);
  }
  const versionDir = await path.join(gameDir, "versions", ver.id);
  await mkdir(versionDir);
  const versionJsonPath = await path.join(versionDir, `${ver.id}.json`);

  // Download version JSON
  await downloadFile(ver.url, versionJsonPath);
}

export async function checkHash(
  filePath: string,
  hash: string,
): Promise<boolean> {
  const buffer = await readFile(filePath);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-1",
    buffer.buffer as ArrayBuffer,
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHash === hash;
}

export async function prepareToInstallModLoader(instance: MinecraftInstance) {
  const jsonPath = await path.join(
    instance.directory,
    "versions",
    instance.version,
    `${instance.version}.json`,
  );
  const jsonText = await readTextFile(jsonPath);
  const jsonObject = JSON.parse(jsonText);

  if (jsonObject.inheritsFrom) {
    throw new Error("Mod loader already installed.");
  }

  return {
    gameVersion: jsonObject.id,
  };
}

export async function installFabric(
  instance: MinecraftInstance,
  gameVersion: string,
  loaderVersion: string,
) {
  const response = await fetch(
    `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`,
  );
  const json = JSON.parse(response.text || "{}");
  const moddedId = json.id;
  const jsonPath = await path.join(
    instance.directory,
    "versions",
    moddedId,
    `${moddedId}.json`,
  );
  const versionDir = await path.dirname(jsonPath);
  if (await exists(versionDir)) {
    throw new Error(`Modded version id ${moddedId} already exists.`);
  }
  await mkdir(versionDir);
  await writeTextFile(jsonPath, JSON.stringify(json));
  return moddedId;
}
