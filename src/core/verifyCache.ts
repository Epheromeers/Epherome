import { path } from "@tauri-apps/api";
import type { MinecraftInstance } from "../store/data";
import { exists, mkdir, readTextFile, writeTextFile } from "../utils/fs";

interface VerifyCacheEntry {
  size: string;
  modifiedMs: string;
  sha1?: string;
}

interface VerifyCacheFile {
  assets?: Record<string, VerifyCacheEntry>;
  libraries?: Record<string, VerifyCacheEntry>;
}

const verifyCacheFilename = "verify-cache.json";

function createEmptyCache(): VerifyCacheFile {
  return {
    assets: {},
    libraries: {},
  };
}

export async function readVerifyCache(
  instance: MinecraftInstance,
): Promise<VerifyCacheFile> {
  const cachePath = await path.join(instance.directory, verifyCacheFilename);
  if (!(await exists(cachePath))) {
    return createEmptyCache();
  }

  try {
    const content = await readTextFile(cachePath);
    const parsed = JSON.parse(content) as VerifyCacheFile;
    return {
      assets: parsed.assets ?? {},
      libraries: parsed.libraries ?? {},
    };
  } catch {
    return createEmptyCache();
  }
}

export async function writeVerifyCache(
  instance: MinecraftInstance,
  cache: VerifyCacheFile,
) {
  const instanceDir = instance.directory;
  if (!(await exists(instanceDir))) {
    await mkdir(instanceDir);
  }
  const cachePath = await path.join(instanceDir, verifyCacheFilename);
  await writeTextFile(cachePath, JSON.stringify(cache));
}

export type { VerifyCacheEntry, VerifyCacheFile };
