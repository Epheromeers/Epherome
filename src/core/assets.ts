import { path } from "@tauri-apps/api";
import type { MinecraftInstance } from "../store/data";
import { checkFiles, exists, inspectFiles, readTextFile } from "../utils/fs";
import type { MinecraftClientJson } from ".";
import { downloadFile } from "./download";
import { readVerifyCache, writeVerifyCache } from "./verifyCache";

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
  const verifyCache = await readVerifyCache(instance);
  const assetCache = verifyCache.assets ?? {};
  const hashByPath: Record<string, string> = {};
  const requests = await Promise.all(
    Object.values(assetIndex.objects).map(async ({ hash }) => {
      const subDir = hash.substring(0, 2);
      const assetPath = await path.join(
        instance.directory,
        "assets",
        "objects",
        subDir,
        hash,
      );
      hashByPath[assetPath] = hash;
      return {
        pathname: assetPath,
        expectedSha1: hash,
      };
    }),
  );

  const inspectResults = await inspectFiles(
    requests.map((item) => ({ pathname: item.pathname })),
  );
  const inspectByPath: Record<
    string,
    {
      exists: boolean;
      size?: string;
      modifiedMs?: string;
      error?: string;
    }
  > = {};
  const hashRequests: {
    pathname: string;
    expectedSha1: string;
  }[] = [];

  for (const inspectResult of inspectResults) {
    inspectByPath[inspectResult.pathname] = {
      exists: inspectResult.exists,
      size: inspectResult.size,
      modifiedMs: inspectResult.modifiedMs,
      error: inspectResult.error,
    };

    const hash = hashByPath[inspectResult.pathname];
    if (!hash || !inspectResult.exists) {
      continue;
    }

    const cached = assetCache[inspectResult.pathname];
    const cacheMatched =
      inspectResult.size &&
      inspectResult.modifiedMs &&
      cached &&
      cached.size === inspectResult.size &&
      cached.modifiedMs === inspectResult.modifiedMs &&
      cached.sha1 === hash;

    if (!cacheMatched) {
      hashRequests.push({
        pathname: inspectResult.pathname,
        expectedSha1: hash,
      });
    }
  }

  const hashResults = await checkFiles(hashRequests);
  const hashResultByPath: Record<
    string,
    {
      exists: boolean;
      hashMatched?: boolean;
      error?: string;
    }
  > = {};
  for (const hashResult of hashResults) {
    hashResultByPath[hashResult.pathname] = {
      exists: hashResult.exists,
      hashMatched: hashResult.hashMatched,
      error: hashResult.error,
    };
  }

  const missingAssets: string[] = [];
  for (const request of requests) {
    const hash = hashByPath[request.pathname];
    if (!hash) {
      continue;
    }

    const inspectResult = inspectByPath[request.pathname];
    if (!inspectResult) {
      continue;
    }
    if (inspectResult.error) {
      console.log(`Asset inspect failed for ${hash}: ${inspectResult.error}`);
      continue;
    }
    if (!inspectResult.exists) {
      missingAssets.push(hash);
      delete assetCache[request.pathname];
      continue;
    }

    const hashResult = hashResultByPath[request.pathname];
    if (hashResult?.error) {
      console.log(`Asset check failed for ${hash}: ${hashResult.error}`);
      continue;
    }
    if (hashResult?.hashMatched === false) {
      console.log(`Hash mismatch for asset ${hash}`);
      continue;
    }

    if (inspectResult.size && inspectResult.modifiedMs) {
      assetCache[request.pathname] = {
        size: inspectResult.size,
        modifiedMs: inspectResult.modifiedMs,
        sha1: hash,
      };
    }
  }

  verifyCache.assets = assetCache;
  await writeVerifyCache(instance, verifyCache);

  return missingAssets;
}
