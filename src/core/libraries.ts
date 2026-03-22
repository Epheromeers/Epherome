import { path } from "@tauri-apps/api";
import type { MinecraftInstance } from "../store/data";
import { checkFiles, exists, inspectFiles } from "../utils/fs";
import type { MinecraftClientJson } from ".";
import { checkHash, downloadFile } from "./download";
import { type ClientJsonRule, isAllCompliant } from "./rules";
import { readVerifyCache, writeVerifyCache } from "./verifyCache";

interface ClientJsonLibraryDownloadArtifact {
  path?: string;
  sha1?: string;
  size?: number;
  url?: string;
}

export interface ClientJsonLibrary {
  downloads?: {
    artifact?: ClientJsonLibraryDownloadArtifact;
    classifiers?: {
      [key: string]: ClientJsonLibraryDownloadArtifact;
    };
  };
  name?: string;
  url?: string;
  clientreq?: boolean;
  serverreq?: boolean;
  extract?: {
    exclude?: string[];
  };
  rules?: ClientJsonRule[];
}

interface ResolvedLibraryItem {
  libPath: string;
  downloadPath?: string;
  downloadUrl?: string;
  sha1?: string;
}

export async function checkLibraries(
  instance: MinecraftInstance,
  clientJson: MinecraftClientJson,
): Promise<[string[], Record<string, string>]> {
  const cpBuff: string[] = [];
  const missingLibraries: Record<string, string> = {};
  const jsonLibraries = clientJson.libraries as ClientJsonLibrary[];
  const nameAdded: string[] = [];
  const resolvedLibraries: ResolvedLibraryItem[] = [];
  const verifyCache = await readVerifyCache(instance);
  const libraryCache = verifyCache.libraries ?? {};

  for (const lib of jsonLibraries) {
    if (lib.rules && !isAllCompliant(lib.rules)) {
      continue;
    }
    if (lib.name) {
      const nameParts = lib.name.split(":");
      const theName = `${nameParts[0]}:${nameParts[1]}:${nameParts.length > 3 ? nameParts[3] : String()}`;
      if (nameAdded.includes(theName)) {
        continue;
      }
      nameAdded.push(theName);
    }
    if (lib.downloads?.artifact?.path) {
      const libPath = await path.join(
        instance.directory,
        "libraries",
        lib.downloads.artifact.path,
      );
      cpBuff.push(libPath);
      resolvedLibraries.push({
        libPath,
        downloadPath: lib.downloads.artifact.path,
        downloadUrl: lib.downloads.artifact.url,
        sha1: lib.downloads.artifact.sha1,
      });
    } else if (lib.name && lib.url) {
      if (lib.clientreq === false) {
        continue;
      }
      const nameParts = lib.name.split(":");
      if (nameParts.length < 3) {
        continue;
      }
      const pkg = nameParts[0].replace(/\./g, "/");
      const name = nameParts[1];
      const version = nameParts[2];
      const jarName = `${name}-${version}.jar`;
      const libPath = await path.join(
        instance.directory,
        "libraries",
        pkg,
        name,
        version,
        jarName,
      );
      const downloadPath = `${pkg}/${name}/${version}/${jarName}`;
      const downloadUrl = `${lib.url.replace(/\/+$/, "")}/${downloadPath}`;
      cpBuff.push(libPath);
      resolvedLibraries.push({
        libPath,
        downloadPath,
        downloadUrl,
      });
    }
  }

  const libraryByPath: Record<string, ResolvedLibraryItem> = {};
  const inspectRequests = resolvedLibraries.map((resolvedLibrary) => {
    libraryByPath[resolvedLibrary.libPath] = resolvedLibrary;
    return {
      pathname: resolvedLibrary.libPath,
    };
  });
  const inspectResults = await inspectFiles(inspectRequests);
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

    const resolvedLibrary = libraryByPath[inspectResult.pathname];
    if (!resolvedLibrary || !resolvedLibrary.sha1 || !inspectResult.exists) {
      continue;
    }

    const cached = libraryCache[inspectResult.pathname];
    const cacheMatched =
      inspectResult.size &&
      inspectResult.modifiedMs &&
      cached &&
      cached.size === inspectResult.size &&
      cached.modifiedMs === inspectResult.modifiedMs &&
      cached.sha1 === resolvedLibrary.sha1;

    if (!cacheMatched) {
      hashRequests.push({
        pathname: inspectResult.pathname,
        expectedSha1: resolvedLibrary.sha1,
      });
    }
  }

  const hashResults = await checkFiles(hashRequests);
  const hashByPath: Record<
    string,
    {
      exists: boolean;
      hashMatched?: boolean;
      error?: string;
    }
  > = {};
  for (const hashResult of hashResults) {
    hashByPath[hashResult.pathname] = {
      exists: hashResult.exists,
      hashMatched: hashResult.hashMatched,
      error: hashResult.error,
    };
  }

  for (const inspectRequest of inspectRequests) {
    const resolvedLibrary = libraryByPath[inspectRequest.pathname];
    if (!resolvedLibrary) {
      continue;
    }
    const inspectResult = inspectByPath[inspectRequest.pathname];
    if (!inspectResult) {
      continue;
    }
    if (inspectResult.error) {
      console.log(
        `Library inspect failed for ${resolvedLibrary.downloadPath ?? resolvedLibrary.libPath}: ${inspectResult.error}`,
      );
      continue;
    }
    if (
      !inspectResult.exists &&
      resolvedLibrary.downloadPath &&
      resolvedLibrary.downloadUrl
    ) {
      missingLibraries[resolvedLibrary.downloadPath] =
        resolvedLibrary.downloadUrl;
      delete libraryCache[inspectRequest.pathname];
      continue;
    }

    const hashResult = hashByPath[inspectRequest.pathname];
    if (hashResult?.error) {
      console.log(
        `Library check failed for ${resolvedLibrary.downloadPath ?? resolvedLibrary.libPath}: ${hashResult.error}`,
      );
      continue;
    }
    if (hashResult?.hashMatched === false) {
      console.log(
        `Hash mismatch for library ${resolvedLibrary.downloadPath ?? resolvedLibrary.libPath}`,
      );
      continue;
    }

    if (
      resolvedLibrary.sha1 &&
      inspectResult.size &&
      inspectResult.modifiedMs
    ) {
      libraryCache[inspectRequest.pathname] = {
        size: inspectResult.size,
        modifiedMs: inspectResult.modifiedMs,
        sha1: resolvedLibrary.sha1,
      };
    }
  }

  verifyCache.libraries = libraryCache;
  await writeVerifyCache(instance, verifyCache);

  return [cpBuff, missingLibraries];
}

export async function checkVersionJar(
  instance: MinecraftInstance,
  clientJson: MinecraftClientJson,
) {
  const clientJarPath = await path.join(
    instance.directory,
    "versions",
    instance.version,
    `${instance.version}.jar`,
  );
  if (!(await exists(clientJarPath))) {
    await downloadFile(clientJson.downloads.client.url, clientJarPath);
  } else if (
    !(await checkHash(clientJarPath, clientJson.downloads.client.sha1))
  ) {
    console.log(`Hash mismatch for version jar ${instance.version}.jar`);
  }
}
