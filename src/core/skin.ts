import type { MinecraftAccount } from "../store/data";
import { fetch } from "../utils/http";

export type MinecraftSkinModel = "default" | "slim";

export interface MinecraftSkinTexture {
  bytes: number[];
  capeBytes?: number[];
  capeError?: string;
  model: MinecraftSkinModel;
}

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const skinRequestTimeoutMs = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessfulStatus(status: number) {
  return status >= 200 && status < 300;
}

function isPng(bytes: number[]) {
  return pngSignature.every((byte, index) => bytes[index] === byte);
}

function getTextureUrl(texture: Record<string, unknown>, name: string) {
  if (typeof texture.url !== "string") {
    throw new Error(`The Minecraft profile does not have a valid ${name}.`);
  }

  let textureUrl: URL;
  try {
    textureUrl = new URL(texture.url);
  } catch {
    throw new Error(`Mojang returned an invalid ${name} URL.`);
  }
  if (
    !["http:", "https:"].includes(textureUrl.protocol) ||
    textureUrl.hostname !== "textures.minecraft.net"
  ) {
    throw new Error(`Mojang returned an untrusted ${name} URL.`);
  }
  textureUrl.protocol = "https:";
  return textureUrl;
}

async function downloadTexture(textureUrl: URL, name: string) {
  const response = await fetch(textureUrl.toString(), {
    response_type: "bytes",
    timeout_ms: skinRequestTimeoutMs,
  });
  if (!isSuccessfulStatus(response.status)) {
    throw new Error(
      `Mojang returned status ${response.status} while loading the ${name}.`,
    );
  }
  if (!response.bytes || !isPng(response.bytes)) {
    throw new Error(`Mojang returned an invalid ${name} image.`);
  }
  return response.bytes;
}

export async function getSkin(
  account: MinecraftAccount,
): Promise<MinecraftSkinTexture> {
  if (!account.uuid) {
    throw new Error("The Microsoft account does not have a Minecraft UUID.");
  }
  const uuid = account.uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(uuid)) {
    throw new Error("The Microsoft account has an invalid Minecraft UUID.");
  }

  const profileResponse = await fetch(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
    { timeout_ms: skinRequestTimeoutMs },
  );
  if (!isSuccessfulStatus(profileResponse.status)) {
    throw new Error(
      `Mojang returned status ${profileResponse.status} while loading the profile.`,
    );
  }
  if (!profileResponse.text) {
    throw new Error("Mojang returned an empty Minecraft profile.");
  }

  let profile: unknown;
  try {
    profile = JSON.parse(profileResponse.text) as unknown;
  } catch {
    throw new Error("Mojang returned an invalid Minecraft profile.");
  }
  if (!isRecord(profile) || !Array.isArray(profile.properties)) {
    throw new Error("The Minecraft profile does not contain skin information.");
  }

  const texturesProperty = profile.properties.find(
    (property) =>
      isRecord(property) &&
      property.name === "textures" &&
      typeof property.value === "string",
  );
  if (
    !isRecord(texturesProperty) ||
    typeof texturesProperty.value !== "string"
  ) {
    throw new Error("The Minecraft profile does not contain skin information.");
  }

  let texturesPayload: unknown;
  try {
    texturesPayload = JSON.parse(atob(texturesProperty.value)) as unknown;
  } catch {
    throw new Error("The Minecraft skin information is invalid.");
  }

  if (
    !isRecord(texturesPayload) ||
    !isRecord(texturesPayload.textures) ||
    !isRecord(texturesPayload.textures.SKIN)
  ) {
    throw new Error("The Minecraft profile does not have a skin.");
  }
  const skin = texturesPayload.textures.SKIN;
  const skinUrl = getTextureUrl(skin, "skin");
  const cape = isRecord(texturesPayload.textures.CAPE)
    ? texturesPayload.textures.CAPE
    : null;

  const capePromise: Promise<{
    bytes?: number[];
    error?: string;
  }> = cape
    ? Promise.resolve()
        .then(() => downloadTexture(getTextureUrl(cape, "cape"), "cape"))
        .then((bytes) => ({ bytes }))
        .catch((err) => ({ error: `${err}` }))
    : Promise.resolve({});
  const [bytes, capeResult] = await Promise.all([
    downloadTexture(skinUrl, "skin"),
    capePromise,
  ]);

  return {
    bytes,
    capeBytes: capeResult.bytes,
    capeError: capeResult.error,
    model:
      isRecord(skin.metadata) && skin.metadata.model === "slim"
        ? "slim"
        : "default",
  };
}
