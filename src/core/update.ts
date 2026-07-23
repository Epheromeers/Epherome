import { fetch } from "../utils/http";

const releasesUrl =
  "https://api.github.com/repos/Epheromeers/Epherome/releases?per_page=100";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  updateAvailable: boolean;
}

function parseSemVer(version: string): SemVer {
  const match = version.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );

  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareSemVer(left: SemVer, right: SemVer): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) {
      return left[key] > right[key] ? 1 : -1;
    }
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) {
      return 0;
    }
    return left.prerelease.length === 0 ? 1 : -1;
  }

  const identifierCount = Math.max(
    left.prerelease.length,
    right.prerelease.length,
  );
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) {
      continue;
    }

    const leftIsNumeric = /^\d+$/.test(leftIdentifier);
    const rightIsNumeric = /^\d+$/.test(rightIdentifier);
    if (leftIsNumeric && rightIsNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1;
    }
    if (leftIsNumeric !== rightIsNumeric) {
      return leftIsNumeric ? -1 : 1;
    }
    return leftIdentifier > rightIdentifier ? 1 : -1;
  }

  return 0;
}

export async function checkForUpdates(
  currentVersion: string,
): Promise<UpdateCheckResult> {
  const response = await fetch(releasesUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Epherome",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  if (!response.text) {
    throw new Error("GitHub returned an empty response");
  }

  const responseBody: unknown = JSON.parse(response.text);
  if (!Array.isArray(responseBody)) {
    throw new Error("GitHub returned invalid release information");
  }

  let latest:
    | { release: GitHubRelease; version: string; semVer: SemVer }
    | undefined;
  for (const item of responseBody) {
    const release = item as Partial<GitHubRelease>;
    if (
      typeof release.tag_name !== "string" ||
      !release.tag_name.startsWith("v") ||
      typeof release.html_url !== "string"
    ) {
      throw new Error("GitHub returned invalid release information");
    }

    const version = release.tag_name.slice(1);
    const semVer = parseSemVer(version);
    if (!latest || compareSemVer(semVer, latest.semVer) > 0) {
      latest = {
        release: release as GitHubRelease,
        version,
        semVer,
      };
    }
  }

  if (!latest) {
    throw new Error("No GitHub releases were found");
  }

  const comparison = compareSemVer(latest.semVer, parseSemVer(currentVersion));

  return {
    currentVersion,
    latestVersion: latest.version,
    releaseUrl: latest.release.html_url,
    updateAvailable: comparison > 0,
  };
}
