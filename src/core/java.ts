import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import type { JavaRuntime } from "../store/data";

interface DetectedJava {
  pathname: string;
  version: string;
  vendor: string;
}

export async function getJavaVersion(javaPath: string): Promise<string | null> {
  try {
    return await invoke("get_java_version", { javaPath });
  } catch {
    return null;
  }
}

/** Parse a Java version string into its major version number. */
export function getJavaMajorVersion(version: string): number | null {
  // "1.8.0_351" -> 8, "17.0.2" -> 17, "21" -> 21
  const parts = version.split(".");
  if (parts[0] === "1" && parts.length >= 2) {
    return Number.parseInt(parts[1], 10) || null;
  }
  return Number.parseInt(parts[0], 10) || null;
}

export async function detectJavas(): Promise<JavaRuntime[]> {
  const detected: DetectedJava[] = await invoke("detect_java_runtimes");

  return detected.map((d) => {
    const major = getJavaMajorVersion(d.version);
    const nickname = major ? `${d.vendor} ${major}` : d.vendor;
    return {
      id: nanoid(),
      nickname,
      pathname: d.pathname,
      version: d.version,
    };
  });
}
