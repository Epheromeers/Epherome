import { useContext, useState } from "react";
import Button from "../components/Button";
import Label from "../components/Label";
import Link from "../components/Link";
import { launchMinecraft } from "../core";
import { getJavaMajorVersion } from "../core/java";
import type { ParallelTask } from "../core/parallel";
import { AppContext } from "../store";
import type { MinecraftAccount, MinecraftInstance } from "../store/data";

/**
 * Determine the minimum required Java major version for a Minecraft version.
 * Returns null if the MC version string cannot be parsed.
 */
function getRequiredJavaMajor(mcVersion: string): number | null {
  // Handle snapshot/custom versions that don't match semver
  const match = mcVersion.match(/^1\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const minor = Number.parseInt(match[1], 10);
  const patch = Number.parseInt(match[2] ?? "0", 10);

  // MC 1.20.5+ requires Java 21
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  // MC 1.17+ requires Java 17 (technically 16 for 1.17, but 17 is the standard)
  if (minor >= 17) return 17;
  // MC 1.16 and below runs on Java 8
  return 8;
}

export default function DashboardView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const account = data.accounts.find((account) => account.checked);
  const instance = data.instances.find((instance) => instance.checked);

  const [downloadList, setDownloadList] = useState<ParallelTask[]>([]);

  const doLaunch = (acc: MinecraftAccount, inst: MinecraftInstance) => {
    launchMinecraft(app, acc, inst, app.setLaunchMessage, setDownloadList)
      .then()
      .catch((e) => {
        app.openDialog({
          title: "Launch Failed",
          message: `${e}`,
        });
      });
  };

  const onLaunchClick = () => {
    if (!account || !instance) return;

    const runtimes = data.settings.javaRuntimes;
    const instanceJava = instance.javaId
      ? runtimes?.find((rt) => rt.id === instance.javaId)
      : undefined;
    const globalJava = runtimes?.find((rt) => rt.checked);
    const selectedJava = instanceJava ?? globalJava;
    const javaVersion = selectedJava?.version;

    const javaMajor = javaVersion ? getJavaMajorVersion(javaVersion) : null;
    const requiredMajor = getRequiredJavaMajor(instance.version);

    if (javaMajor && requiredMajor && javaMajor < requiredMajor) {
      app.openDialog({
        title: "Java Version Mismatch",
        message: `Minecraft ${instance.version} requires Java ${requiredMajor}+, but the selected runtime is Java ${javaMajor}. Launching may fail.`,
        actionMessage: "Launch Anyway",
        action: () => doLaunch(account, instance),
      });
      return;
    }

    doLaunch(account, instance);
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="rounded border border-gray-300 dark:border-gray-700 p-2 text-sm">
        <div>
          Welcome to Epherome! It is very unstable and incomplete currently,
          with many potential bugs.
        </div>
        <div className="flex items-center space-x-2">
          <div>User guides will be available on:</div>
          <Link target="https://epherome.com">https://epherome.com</Link>
        </div>
        <div className="flex items-center space-x-2">
          <div>Open source at:</div>
          <Link target="https://github.com/Epheromeers/Epherome">
            https://github.com/Epheromeers/Epherome
          </Link>
        </div>
      </div>
      {downloadList.map((item) => (
        <div key={item.id}>Downloading {item.name}...</div>
      ))}
      <div className="grow" />
      <div>{app.getLaunchMessage()}</div>
      <div className="flex items-center space-x-3">
        <Button
          onClick={onLaunchClick}
          disabled={
            typeof app.getLaunchMessage() === "string" || !account || !instance
          }
        >
          Launch
        </Button>
        <div className="grow" />
        <div>
          <Label title="Account">{account ? account.username : "None"}</Label>
          <Label title="Instance">{instance ? instance.name : "None"}</Label>
        </div>
      </div>
    </div>
  );
}
