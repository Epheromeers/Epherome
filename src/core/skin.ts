import type { MinecraftAccount } from "../store/data";
import { fetch } from "../utils/http";

export async function getSkin(account: MinecraftAccount): Promise<string> {
  const resp = await fetch(
    `https://sessionserver.mojang.com/session/minecraft/profile/${account.uuid}`,
  );
  const data = JSON.parse(resp.text || "{}");
  const skin = data.properties.find(
    (property: { name: string; value: string }) => property.name === "textures",
  ).value;
  const skinData = JSON.parse(atob(skin));
  return skinData.textures.SKIN.url;
}
