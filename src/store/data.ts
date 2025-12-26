import { path } from "@tauri-apps/api";
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

export type MinecraftAccountCategory = "microsoft" | "custom" | "offline";

export type ColorTheme = "light" | "dark" | "system";

export interface MinecraftAccount {
  id: string;
  timestamp: number;
  username: string;
  category: MinecraftAccountCategory;
  uuid?: string;
  accessToken?: string;
  checked?: boolean;
}

export interface MinecraftInstance {
  id: string;
  timestamp: number;
  name: string;
  directory: string;
  version: string;
  checked?: boolean;
}

export interface UserData {
  accounts: MinecraftAccount[];
  instances: MinecraftInstance[];
  settings: {
    javaPath: string;
    theme: ColorTheme;
  };
}

export const fallbackUserData: UserData = {
  accounts: [],
  instances: [],
  settings: {
    javaPath: "java",
    theme: "system",
  },
};

export async function ensureDataDir() {
  const dataDir = await path.appDataDir();
  const dataPath = await path.join(await path.appDataDir(), "epherome.json");

  if (!(await exists(dataDir))) {
    await mkdir(dataDir);
  }
  if (!(await exists(dataPath))) {
    await writeTextFile(dataPath, JSON.stringify(fallbackUserData));
  }
}

export async function readUserData() {
  const dataPath = await path.join(await path.appDataDir(), "epherome.json");
  const dataContent = await readTextFile(dataPath);
  return JSON.parse(dataContent) as UserData;
}

export async function writeUserData(userData: UserData) {
  const dataPath = await path.join(await path.appDataDir(), "epherome.json");
  await writeTextFile(dataPath, JSON.stringify(userData));
}
