import { invoke } from "@tauri-apps/api/core";
import { nanoid } from "nanoid";
import type { JavaRuntime } from "../store/data";

export async function getJavaVersion(javaPath: string): Promise<string | null> {
  return await invoke("get_java_version", { javaPath });
}

export async function detectJavas(): Promise<JavaRuntime[]> {
  // TODO Detect java runtimes in other locations
  const runtimes: JavaRuntime[] = [];

  const defaultJavaVersion = await getJavaVersion("java");

  if (defaultJavaVersion) {
    runtimes.push({
      id: nanoid(),
      pathname: "java",
      version: defaultJavaVersion,
    });
  }

  return runtimes;
}
