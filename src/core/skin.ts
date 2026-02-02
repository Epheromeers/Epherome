import { fetch } from "@tauri-apps/plugin-http";
import type { MinecraftAccount } from "../store/data";

export async function getSkin(account: MinecraftAccount): Promise<string> {
  const resp = await fetch(
    `https://sessionserver.mojang.com/session/minecraft/profile/${account.uuid}`,
  );
  const data = await resp.json();
  const skin = data.properties.find(
    (property: { name: string; value: string }) => property.name === "textures",
  ).value;
  const skinData = JSON.parse(atob(skin));
  return skinData.textures.SKIN.url;
}
