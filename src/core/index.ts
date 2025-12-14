import { path } from "@tauri-apps/api";
import { getVersion } from "@tauri-apps/api/app";
import { dirname } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import type { MinecraftAccount, MinecraftInstance } from "../config";
import {
  type ClientJsonArguments,
  parseClientJsonArguments,
} from "./arguments";
import type { AssetIndex } from "./assets";
import { downloadFile } from "./download";
import type { ClientJsonLibrary } from "./libraries";
import { isAllCompliant } from "./rules";

export async function launchMinecraft(
  account: MinecraftAccount,
  instance: MinecraftInstance,
) {
  const jsonPath = await path.join(
    instance.directory,
    "versions",
    instance.version,
    `${instance.version}.json`,
  );
  const jsonContent = await readTextFile(jsonPath);
  const jsonObject = JSON.parse(jsonContent);

  const cpBuff: string[] = [];
  const jsonLibraries = jsonObject.libraries as ClientJsonLibrary[];
  for (const lib of jsonLibraries) {
    if (lib.rules && !isAllCompliant(lib.rules)) {
      continue;
    }
    if (lib.downloads?.artifact?.path) {
      const libPath = await path.join(
        instance.directory,
        "libraries",
        lib.downloads.artifact.path,
      );
      if (!(await exists(libPath))) {
        if (lib.downloads.artifact.url) {
          console.log(
            `Library not found: ${libPath}, downloading from ${lib.downloads.artifact.url}`,
          );
          await mkdir(await dirname(libPath), { recursive: true });
          await downloadFile(lib.downloads.artifact.url, libPath);
        } else console.log(`No download URL for library: ${libPath}`);
      } else console.log(`Adding library to classpath: ${libPath}`);
      cpBuff.push(libPath);
    }
  }
  cpBuff.push(
    await path.join(
      instance.directory,
      "versions",
      instance.version,
      `${instance.version}.jar`,
    ),
  );

  // check and download asset index
  const assetIndexId = jsonObject.assetIndex.id;
  const assetIndexUrl = jsonObject.assetIndex.url;
  const assetIndexPath = await path.join(
    instance.directory,
    "assets",
    "indexes",
    `${assetIndexId}.json`,
  );
  if (!(await exists(assetIndexPath))) {
    await mkdir(await dirname(assetIndexPath), { recursive: true });
    await downloadFile(assetIndexUrl, assetIndexPath);
  }

  const assetIndexContent = await readTextFile(assetIndexPath);
  const assetIndexObject = JSON.parse(assetIndexContent) as AssetIndex;
  const assetObjects = assetIndexObject.objects;
  for (const [_, value] of Object.entries(assetObjects)) {
    const hash = value.hash;
    const subDir = hash.substring(0, 2);
    const assetPath = await path.join(
      instance.directory,
      "assets",
      "objects",
      subDir,
      hash,
    );
    if (!(await exists(assetPath))) {
      const assetUrl = `https://resources.download.minecraft.net/${subDir}/${hash}`;
      console.log(
        `Asset not found: ${assetPath}, downloading from ${assetUrl}`,
      );
      await mkdir(await dirname(assetPath), { recursive: true });
      await downloadFile(assetUrl, assetPath);
    }
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
    classpath: cpBuff.join(":"),
  });

  const launchCommand = [...jvmArgs, jsonObject.mainClass, ...gameArgs];

  const command = Command.create("java", launchCommand);
  const result = await command.execute();
  console.log("Minecraft exited with result: ", result);
}
