import { path } from "@tauri-apps/api";
import { exists } from "@tauri-apps/plugin-fs";
import type { MinecraftInstance } from "../config";
import type { MinecraftClientJson } from ".";
import { type ClientJsonRule, isAllCompliant } from "./rules";

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

export async function checkLibraries(
  instance: MinecraftInstance,
  clientJson: MinecraftClientJson,
): Promise<[string[], Record<string, string>]> {
  const cpBuff: string[] = [];
  const missingLibraries: Record<string, string> = {};
  const jsonLibraries = clientJson.libraries as ClientJsonLibrary[];
  const nameAdded: string[] = [];

  for (const lib of jsonLibraries) {
    if (lib.rules && !isAllCompliant(lib.rules)) {
      continue;
    }
    if (lib.name) {
      const nameParts = lib.name.split(":");
      const theName = `${nameParts[0]}:${nameParts[1]}`;
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
      if (!(await exists(libPath)) && lib.downloads.artifact.url) {
        missingLibraries[lib.downloads.artifact.path] =
          lib.downloads.artifact.url;
      }
      cpBuff.push(libPath);
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
      if (!(await exists(libPath))) {
        const downloadUrl = `${lib.url.replace(/\/+$/, "")}/${pkg}/${name}/${version}/${jarName}`;
        missingLibraries[`${pkg}/${name}/${version}/${jarName}`] = downloadUrl;
      }
      cpBuff.push(libPath);
    }
  }
  return [cpBuff, missingLibraries];
}
