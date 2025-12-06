export interface MinecraftInstance {
  name: string;
  directory: string;
  version: string;
}

export type MinecraftAccountCategory = "microsoft" | "offline";

export interface MinecraftAccount {
  username: string;
  category: MinecraftAccountCategory;
  uuid?: string;
  accessToken?: string;
}

export const configStore = {
  accounts: [] as MinecraftAccount[],
  instances: [] as MinecraftInstance[],
  javaPath: String(),
};
