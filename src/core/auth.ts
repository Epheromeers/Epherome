import { invoke } from "@tauri-apps/api/core";
import { once } from "@tauri-apps/api/event";
import type { MinecraftAccount } from "../store/data";
import { fetch } from "../utils/http";

export interface MicrosoftAccountAuthResult {
  username: string;
  uuid: string;
  xblToken: string;
  xblNotAfter: string;
  userHash: string;
  accessToken: string;
}

interface MicrosoftTokenResponse {
  access_token?: unknown;
  error?: unknown;
  error_description?: unknown;
}

let microsoftAuthenticationInProgress = false;

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Microsoft authentication returned no ${fieldName}.`);
  }
  return value;
}

export async function getAuthCode(): Promise<string | null> {
  let resolveAuthCode: (authCode: string | null) => void = () => undefined;
  const authCodePromise = new Promise<string | null>((resolve) => {
    resolveAuthCode = resolve;
  });
  const unlisten = await once<unknown>("ms-auth-code", (event) => {
    const payload = event.payload;
    resolveAuthCode(
      typeof payload === "string" && payload.trim().length > 0 ? payload : null,
    );
  });

  try {
    await invoke("get_microsoft_auth_code");
  } catch (err) {
    unlisten();
    throw err;
  }

  return await authCodePromise;
}

export async function getAuthToken(authCode: string): Promise<string> {
  const response = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: "00000000402b5328",
      code: authCode,
      grant_type: "authorization_code",
      redirect_uri: "https://login.live.com/oauth20_desktop.srf",
      scope: "service::user.auth.xboxlive.com::MBI_SSL",
    }).toString(),
  });

  let responseJson: MicrosoftTokenResponse;
  try {
    responseJson = JSON.parse(response.text || "{}") as MicrosoftTokenResponse;
  } catch {
    throw new Error(
      `Microsoft token request returned invalid JSON (HTTP ${response.status}).`,
    );
  }

  const accessToken = responseJson.access_token;
  if (
    response.status < 200 ||
    response.status >= 300 ||
    typeof accessToken !== "string" ||
    accessToken.trim().length === 0
  ) {
    const errorDescription =
      typeof responseJson.error_description === "string"
        ? responseJson.error_description
        : undefined;
    const errorCode =
      typeof responseJson.error === "string" ? responseJson.error : undefined;
    throw new Error(
      `Microsoft token request failed (HTTP ${response.status}): ${errorDescription ?? errorCode ?? "No access token returned."}`,
    );
  }

  return accessToken;
}

export async function getXBLToken(authToken: string) {
  const response = await fetch(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: authToken,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
      }),
    },
  );
  const responseJson = JSON.parse(response.text || "{}");
  const xblToken = responseJson.Token;
  const xblNotAfter = responseJson.NotAfter;
  const userHash = responseJson.DisplayClaims?.xui?.[0]?.uhs;
  return { xblToken, xblNotAfter, userHash };
}

export async function getXSTSToken(xblToken: string) {
  const response = await fetch(
    "https://xsts.auth.xboxlive.com/xsts/authorize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken],
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT",
      }),
    },
  );
  const responseJson = JSON.parse(response.text || "{}");
  const xstsToken = responseJson.Token;
  return xstsToken;
}

export async function getMinecraftToken(
  userHash: string,
  xstsToken: string,
): Promise<string> {
  const response = await fetch(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
      }),
    },
  );
  const responseJson = JSON.parse(response.text || "{}");
  return responseJson.access_token;
}

export async function getMinecraftProfile(minecraftToken: string) {
  const response = await fetch(
    "https://api.minecraftservices.com/minecraft/profile",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${minecraftToken}`,
      },
    },
  );
  const responseJson = JSON.parse(response.text || "{}");
  return { id: responseJson.id, name: responseJson.name };
}

export async function authenticateMicrosoftAccount(): Promise<MicrosoftAccountAuthResult | null> {
  if (microsoftAuthenticationInProgress) {
    throw new Error("Microsoft authentication is already in progress.");
  }

  microsoftAuthenticationInProgress = true;
  try {
    const authCode = await getAuthCode();
    if (authCode === null) return null;

    const authToken = await getAuthToken(authCode);
    const xblResult = await getXBLToken(authToken);
    const xblToken = requireNonEmptyString(xblResult.xblToken, "XBL token");
    const xblNotAfter = requireNonEmptyString(
      xblResult.xblNotAfter,
      "XBL token expiry",
    );
    const userHash = requireNonEmptyString(
      xblResult.userHash,
      "Xbox user hash",
    );
    const xstsToken = requireNonEmptyString(
      await getXSTSToken(xblToken),
      "XSTS token",
    );
    const accessToken = requireNonEmptyString(
      await getMinecraftToken(userHash, xstsToken),
      "Minecraft access token",
    );
    const profile = await getMinecraftProfile(accessToken);
    const uuid = requireNonEmptyString(profile.id, "Minecraft profile UUID");
    const username = requireNonEmptyString(
      profile.name,
      "Minecraft profile username",
    );

    return {
      username,
      uuid,
      xblToken,
      xblNotAfter,
      userHash,
      accessToken,
    };
  } finally {
    microsoftAuthenticationInProgress = false;
  }
}

export function getMicrosoftAccountTokenExpiry(
  account: MinecraftAccount,
): Date | null {
  if (!account.userHash || !account.xblToken || !account.xblNotAfter) {
    return null;
  }

  const expiry = new Date(account.xblNotAfter);
  return Number.isNaN(expiry.getTime()) ? null : expiry;
}

export async function refreshMicrosoftAccount(account: MinecraftAccount) {
  const expiry = getMicrosoftAccountTokenExpiry(account);
  const xblToken = account.xblToken;
  const userHash = account.userHash;
  if (expiry && expiry > new Date() && xblToken && userHash) {
    const xstsToken = await getXSTSToken(xblToken);
    const minecraftToken = await getMinecraftToken(userHash, xstsToken);
    return minecraftToken;
  }
}
