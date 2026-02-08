import { invoke } from "@tauri-apps/api/core";

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  response_type?: "text" | "bytes";
}

export interface FetchResponse {
  status: number;
  text?: string;
  bytes?: number[];
  headers: Record<string, string>;
}

export async function fetch(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResponse> {
  try {
    const response = await invoke<FetchResponse>("fetch", {
      url,
      options,
    });
    return response;
  } catch (error) {
    throw new Error(
      `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    response_type: "text",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.text) {
    throw new Error("Empty response body");
  }

  return JSON.parse(response.text) as T;
}

export async function fetchText(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const response = await fetch(url, {
    ...options,
    response_type: "text",
  });
  return response.text || "";
}
