import { path } from "@tauri-apps/api";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import type { MinecraftInstance } from "../config";
import type { MinecraftClientJson } from ".";
import { checkHash, downloadFile } from "./download";

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>;
}

export async function checkAssets(
  instance: MinecraftInstance,
  clientJson: MinecraftClientJson,
): Promise<string[]> {
  const assetIndexId = clientJson.assetIndex.id;
  const assetIndexUrl = clientJson.assetIndex.url;
  const assetIndexPath = await path.join(
    instance.directory,
    "assets",
    "indexes",
    `${assetIndexId}.json`,
  );
  if (!(await exists(assetIndexPath))) {
    await downloadFile(assetIndexUrl, assetIndexPath);
  }

  const assetIndex: AssetIndex = JSON.parse(await readTextFile(assetIndexPath));
  const missingAssets: string[] = [];

  for (const { hash } of Object.values(assetIndex.objects)) {
    const subDir = hash.substring(0, 2);
    const assetPath = await path.join(
      instance.directory,
      "assets",
      "objects",
      subDir,
      hash,
    );
    if (!(await exists(assetPath))) {
      missingAssets.push(hash);
    } else if (!(await checkHash(assetPath, hash))) {
      console.log(`Hash mismatch for asset ${hash}`);
    }
  }
  return missingAssets;
}
