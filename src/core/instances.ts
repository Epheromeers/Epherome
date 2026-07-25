import { path } from "@tauri-apps/api";
import { exists, readDir, readTextFile } from "../utils/fs";

const versionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isMinecraftVersionJson(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}

export async function listInstalledMinecraftVersions(
  gameDirectory: string,
): Promise<string[]> {
  const versionDirectory = await path.join(gameDirectory, "versions");
  if (!(await exists(versionDirectory))) {
    throw new Error(
      `The versions directory does not exist at the specified path: ${versionDirectory}`,
    );
  }

  const entries = await readDir(versionDirectory);
  const versions = await Promise.all(
    entries.map(async (entry): Promise<string | null> => {
      if (!entry.isDirectory || entry.name.startsWith(".")) {
        return null;
      }

      const jsonPath = await path.join(
        versionDirectory,
        entry.name,
        `${entry.name}.json`,
      );
      try {
        const contents = await readTextFile(jsonPath);
        return isMinecraftVersionJson(JSON.parse(contents)) ? entry.name : null;
      } catch {
        return null;
      }
    }),
  );

  return versions
    .filter((version): version is string => version !== null)
    .sort((left, right) => versionCollator.compare(right, left));
}
