import { path } from "@tauri-apps/api";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { delimiter } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { AppContextType } from "../store";
import type { MinecraftAccount, MinecraftInstance } from "../store/data";
import {
  type ClientJsonArguments,
  parseClientJsonArguments,
} from "./arguments";
import { checkAssets } from "./assets";
import { refreshMicrosoftAccount } from "./auth";
import {
  type ClientJsonLibrary,
  checkLibraries,
  checkVersionJar,
} from "./libraries";
import { ParallelManager, type ParallelTask } from "./parallel";

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
  app: AppContextType,
  account: MinecraftAccount,
  instance: MinecraftInstance,
  setMessage: (msg: string | undefined) => void,
  setDownloadList: (list: ParallelTask[]) => void,
) {
  setMessage("Preparing to launch");

  // Check account availability
  if (account.category === "microsoft") {
    const tokenPayload = JSON.parse(
      atob(account.accessToken?.split(".")[1] ?? ""),
    );
    if (new Date(tokenPayload.exp * 1000) < new Date()) {
      const refreshed = await refreshMicrosoftAccount(account);
      if (refreshed) {
        app.setData((data) => {
          const formerAccount = data.accounts.find(
            (acc) => acc.id === account.id,
          );
          if (formerAccount) {
            formerAccount.accessToken = refreshed;
          }
        });
        account.accessToken = refreshed;
      }
    }
  }

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

  if (jsonObject.inheritsFrom) {
    classpath.push(
      await path.join(
        instance.directory,
        "versions",
        jsonObject.inheritsFrom,
        `${jsonObject.inheritsFrom}.jar`,
      ),
    );
  } else {
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

  const libraryDownloadManager = new ParallelManager(
    await Promise.all(
      missingLibrariesEntries.map(async ([dest, url]) => {
        const destination = await path.join(
          instance.directory,
          "libraries",
          dest,
        );
        return {
          url,
          name: await path.basename(destination),
          destination,
        };
      }),
    ),
    (list) => {
      setMessage(
        `Downloading missing library (${libraryDownloadManager.finished}/${missingLibrariesEntries.length})`,
      );
      setDownloadList(list);
    },
  );

  libraryDownloadManager.start();

  await new Promise<void>((resolve) => {
    libraryDownloadManager.setOnFinish(resolve);
  });

  const assetDownloadManager = new ParallelManager(
    await Promise.all(
      missingAssets.map(async (hash) => {
        const subdir = hash.substring(0, 2);
        const destination = await path.join(
          instance.directory,
          "assets",
          "objects",
          subdir,
          hash,
        );
        return {
          url: `https://resources.download.minecraft.net/${subdir}/${hash}`,
          name: await path.basename(destination),
          destination,
        };
      }),
    ),
    (list) => {
      setMessage(
        `Downloading missing asset (${assetDownloadManager.finished}/${missingAssets.length})`,
      );
      setDownloadList(list);
    },
  );

  assetDownloadManager.start();

  await new Promise<void>((resolve) => {
    assetDownloadManager.setOnFinish(resolve);
  });

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
    classpath: classpath.join(delimiter()),
  });

  const launchCommand = [...jvmArgs, jsonObject.mainClass, ...gameArgs];

  setMessage("Minecraft is running");

  try {
    await invoke("launch_minecraft", {
      javaPath:
        app.getData().settings.javaRuntimes?.find((rt) => rt.checked)
          ?.pathname ?? "java",
      cwd: instance.directory,
      args: launchCommand,
      nanoid: instance.id,
    });
  } catch (e) {
    app.openDialog({
      title: "Launch Failed",
      message: `${e}`,
    });
  }
  setMessage(undefined);
}
