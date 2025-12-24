import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fetch } from "@tauri-apps/plugin-http";

export async function getAuthCode(): Promise<string> {
  invoke("get_microsoft_auth_code");
  return await new Promise((resolve) => {
    listen("ms-auth-code", (event) => {
      if (typeof event.payload === "string") resolve(event.payload);
      else resolve("");
    });
  });
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
    }),
  });
  const responseJson = await response.json();
  return responseJson.access_token;
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
  const responseJson = await response.json();
  const xblToken = responseJson.Token;
  const userHash = responseJson.DisplayClaims.xui[0].uhs;
  return { xblToken, userHash };
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
  const responseJson = await response.json();
  const xstsToken = responseJson.Token;
  return xstsToken;
}

export async function getMinecraftToken(userHash: string, xstsToken: string) {
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
  const responseJson = await response.json();
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
  const responseJson = await response.json();
  return { id: responseJson.id, name: responseJson.name };
}
