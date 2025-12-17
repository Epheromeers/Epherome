import { path } from "@tauri-apps/api";
import { getVersion } from "@tauri-apps/api/app";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import type { MinecraftAccount, MinecraftInstance } from "../config";
import {
  type ClientJsonArguments,
  parseClientJsonArguments,
} from "./arguments";
import { checkAssets } from "./assets";
import { downloadFile } from "./download";
import {
  type ClientJsonLibrary,
  checkLibraries,
  checkVersionJar,
} from "./libraries";

export interface MinecraftClientJson {
  mainClass: string;
  arguments: ClientJsonArguments;
  assetIndex: {
    id: string;
    url: string;
    size: number;
    totalSize: number;
    sha1: string;
  };
  downloads: {
    client: {
      sha1: string;
      size: number;
      url: string;
    };
  };
  libraries: ClientJsonLibrary[];
  inheritsFrom?: string;
}

export async function launchMinecraft(
  account: MinecraftAccount,
  instance: MinecraftInstance,
  setMessage: (msg: string | undefined) => void,
) {
  setMessage("Preparing to launch");

  const jsonPath = await path.join(
    instance.directory,
    "versions",
    instance.version,
    `${instance.version}.json`,
  );
  const jsonContent = await readTextFile(jsonPath);
  let jsonObject = JSON.parse(jsonContent);

  if (jsonObject.inheritsFrom) {
    const parentJsonPath = await path.join(
      instance.directory,
      "versions",
      jsonObject.inheritsFrom,
      `${jsonObject.inheritsFrom}.json`,
    );
    const parentJsonContent = await readTextFile(parentJsonPath);
    const parentJsonObject = JSON.parse(parentJsonContent);

    jsonObject.libraries.push(...parentJsonObject.libraries);
    jsonObject.arguments.jvm.push(...parentJsonObject.arguments.jvm);
    jsonObject.arguments.game.push(...parentJsonObject.arguments.game);

    const newJsonObject = { ...parentJsonObject, ...jsonObject };
    jsonObject = newJsonObject;
  }

  const [classpath, missingLibraries] = await checkLibraries(
    instance,
    jsonObject,
  );

  if (!jsonObject.inheritsFrom) {
    setMessage("Checking version jar");
    await checkVersionJar(instance, jsonObject);
  }

  classpath.push(
    await path.join(
      instance.directory,
      "versions",
      instance.version,
      `${instance.version}.jar`,
    ),
  );

  const missingAssets = await checkAssets(instance, jsonObject);

  const missingLibrariesEntries = Object.entries(missingLibraries);
  for (const key in missingLibrariesEntries) {
    const [dest, url] = missingLibrariesEntries[key];
    setMessage(
      `Downloading missing library (${key}/${missingLibrariesEntries.length})`,
    );
    await downloadFile(
      url,
      await path.join(instance.directory, "libraries", dest),
    );
  }

  for (const key in missingAssets) {
    const hash = missingAssets[key];
    const subdir = hash.substring(0, 2);
    const assetPath = await path.join(
      instance.directory,
      "assets",
      "objects",
      subdir,
      hash,
    );
    const assetUrl = `https://resources.download.minecraft.net/${subdir}/${hash}`;
    setMessage(`Downloading missing asset (${key}/${missingAssets.length})`);
    await downloadFile(assetUrl, assetPath);
  }

  const jsonArguments = jsonObject.arguments as ClientJsonArguments;
  const { gameArgs, jvmArgs } = parseClientJsonArguments(jsonArguments, {
    auth_player_name: account.username,
    version_name: instance.version,
    game_directory: instance.directory,
    assets_root: await path.join(instance.directory, "assets"),
    assets_index_name: jsonObject.assets,
    auth_uuid: account.uuid ?? "00000000000000000000000000000000",
    auth_access_token: account.accessToken ?? "0.0.0",
    // clientid: "clientid",
    // auth_xuid: "xuid",
    version_type: jsonObject.type,
    user_type: "mojang",
    natives_directory: await path.join(
      instance.directory,
      "versions",
      instance.version,
      "natives",
    ),
    launcher_name: "Epherome",
    launcher_version: await getVersion(),
    classpath: classpath.join(":"),
  });

  const launchCommand = [...jvmArgs, jsonObject.mainClass, ...gameArgs];

  const command = Command.create("java", launchCommand, {
    cwd: instance.directory,
  });

  setMessage("Minecraft is running");

  const result = await command.execute();
  console.log("Minecraft exited with result: ", result);

  setMessage(undefined);
}
