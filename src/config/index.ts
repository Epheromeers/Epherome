import { BaseDirectory, writeTextFile } from "@tauri-apps/plugin-fs";

export interface MinecraftInstance {
  name: string;
  directory: string;
  version: string;
  checked?: boolean;
}

export type MinecraftAccountCategory = "microsoft" | "custom" | "offline";

export interface MinecraftAccount {
  username: string;
  category: MinecraftAccountCategory;
  uuid?: string;
  accessToken?: string;
  checked?: boolean;
}

export const configStore = {
  data: {
    accounts: [] as MinecraftAccount[],
    instances: [] as MinecraftInstance[],
    javaPath: "java",
  },
};

export async function saveConfig() {
  await writeTextFile("epherome.json", JSON.stringify(configStore.data), {
    baseDir: BaseDirectory.AppData,
  });
}
