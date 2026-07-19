import { path } from "@tauri-apps/api";
import { exists, mkdir, readTextFile, writeTextFile } from "../utils/fs";

export type MinecraftAccountCategory = "microsoft" | "custom" | "offline";

export type ColorTheme = "light" | "dark" | "system";

export interface MinecraftAccount {
  id: string;
  timestamp: number;
  username: string;
  category: MinecraftAccountCategory;
  uuid?: string;
  xblToken?: string;
  xblNotAfter?: string;
  userHash?: string;
  accessToken?: string;
  checked?: boolean;
}

export interface MinecraftInstance {
  id: string;
  timestamp: number;
  name: string;
  directory: string;
  version: string;
  javaId?: string;
  checked?: boolean;
}

export interface JavaRuntime {
  id: string;
  nickname?: string;
  pathname: string;
  version?: string;
  checked?: boolean;
}

export interface UserData {
  accounts: MinecraftAccount[];
  instances: MinecraftInstance[];
  settings: {
    developerTools: boolean;
    javaRuntimes?: JavaRuntime[];
    theme: ColorTheme;
    independentInstance?: boolean;
  };
}

type StoredUserData = Omit<Partial<UserData>, "settings"> & {
  settings?: Partial<UserData["settings"]>;
};

export const fallbackUserData: UserData = {
  accounts: [],
  instances: [],
  settings: {
    developerTools: false,
    javaRuntimes: [],
    theme: "system",
    independentInstance: false,
  },
};

export async function ensureDataDir() {
  const dataDir = await path.appDataDir();
  const dataPath = await path.join(await path.appDataDir(), "data.json");

  if (!(await exists(dataDir))) {
    await mkdir(dataDir);
  }
  if (!(await exists(dataPath))) {
    await writeTextFile(dataPath, JSON.stringify(fallbackUserData));
  }
}

export async function readUserData(): Promise<UserData> {
  const dataPath = await path.join(await path.appDataDir(), "data.json");
  const dataContent = await readTextFile(dataPath);
  const dataObject = JSON.parse(dataContent) as StoredUserData;
  return {
    ...fallbackUserData,
    ...dataObject,
    settings: {
      ...fallbackUserData.settings,
      ...dataObject.settings,
    },
  };
}

export async function writeUserData(userData: UserData) {
  const dataPath = await path.join(await path.appDataDir(), "data.json");
  await writeTextFile(dataPath, JSON.stringify(userData));
}
