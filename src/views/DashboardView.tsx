import { ChevronRight } from "lucide-react";
import { useContext, useState } from "react";
import Label from "../components/Label";
import Link from "../components/Link";
import Spin from "../components/Spin";
import { launchMinecraft } from "../core";
import { getJavaMajorVersion } from "../core/java";
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

  const [failedAvatar, setFailedAvatar] = useState(String());

  const accountAvatar =
    account?.category === "microsoft" && account.uuid
      ? `https://minotar.net/avatar/${account.uuid}`
      : undefined;

  const doLaunch = (acc: MinecraftAccount, inst: MinecraftInstance) => {
    launchMinecraft(app, acc, inst, app.setLaunchMessage)
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

    if (!selectedJava) {
      app.openDialog({
        title: "No Java Runtime Selected",
        message:
          'Please select a Java runtime in Settings. If you continue, Epherome will use "java" from PATH.',
        actionMessage: "Use PATH Java",
        action: () => doLaunch(account, instance),
      });
      return;
    }

    const javaVersion = selectedJava.version;

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

  const launchButtonDisabled: "launching" | "unavailable" | null =
    typeof app.getLaunchMessage() === "string"
      ? "launching"
      : !account || !instance
        ? "unavailable"
        : null;
  const launchStatus =
    launchButtonDisabled === "launching"
      ? {
          className:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
          label: "Launching",
        }
      : launchButtonDisabled === "unavailable"
        ? {
            className:
              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
            label: "Setup required",
          }
        : {
            className:
              "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
            label: "Ready",
          };
  const instanceSelectionAction = instance
    ? "Change"
    : data.instances.length > 0
      ? "Select"
      : "Add";
  const accountSelectionAction = account
    ? "Change"
    : data.accounts.length > 0
      ? "Select"
      : "Add";

  return (
    <div className="min-h-full p-6">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-6">
        <main className="flex grow items-center">
          <section className="w-full overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-700">
            <div className="flex items-center justify-between gap-3 border-b border-gray-300 p-4 dark:border-gray-600">
              <h2 className="text-lg font-semibold">Ready to play?</h2>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${launchStatus.className}`}
              >
                {launchStatus.label}
              </span>
            </div>

            <div className="grid gap-3 p-6 sm:grid-cols-2">
              <button
                aria-label={`${instanceSelectionAction} instance`}
                className="group flex min-h-20 w-full flex-col items-stretch rounded-lg bg-gray-100 p-4 text-left transition-colors hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 ring-blue-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-600"
                onClick={() => app.setView("instances")}
                type="button"
              >
                <div className="min-w-0 w-full grow">
                  <Label title="Instance">
                    <div className="mt-1 whitespace-normal wrap-break-word font-medium">
                      {instance ? instance.name : "None selected"}
                    </div>
                    {instance && (
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Minecraft {instance.version}
                      </div>
                    )}
                  </Label>
                </div>
                {!instance && (
                  <div className="mt-3 flex items-center gap-1 self-start text-sm font-medium text-blue-500">
                    <span>{instanceSelectionAction}</span>
                    <ChevronRight aria-hidden="true" size={16} />
                  </div>
                )}
              </button>
              <button
                aria-label={`${accountSelectionAction} account`}
                className="group flex min-h-20 w-full flex-col items-stretch rounded-lg bg-gray-100 p-4 text-left transition-colors hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 ring-blue-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-600"
                onClick={() => app.setView("accounts")}
                type="button"
              >
                <div className="flex min-w-0 w-full grow items-center">
                  {accountAvatar && accountAvatar !== failedAvatar && (
                    <img
                      alt=""
                      className="mr-3 size-10 shrink-0 rounded-md"
                      onError={() => setFailedAvatar(accountAvatar)}
                      src={accountAvatar}
                    />
                  )}
                  <div className="min-w-0 grow">
                    <Label title="Account">
                      <div className="mt-1 whitespace-normal wrap-break-word font-medium">
                        {account ? account.username : "None selected"}
                      </div>
                      {account && (
                        <div className="mt-1 text-sm capitalize text-gray-500 dark:text-gray-400">
                          {account.category} account
                        </div>
                      )}
                    </Label>
                  </div>
                </div>
                {!account && (
                  <div className="mt-3 flex items-center gap-1 self-start text-sm font-medium text-blue-500">
                    <span>{accountSelectionAction}</span>
                    <ChevronRight aria-hidden="true" size={16} />
                  </div>
                )}
              </button>
            </div>

            <div className="flex flex-col items-center px-6 pb-6 text-center">
              <div className="mb-4 min-h-5 text-sm">
                {app.getLaunchMessage()}
              </div>
              {launchButtonDisabled === "unavailable" && (
                <div className="mb-2 text-sm text-red-500">
                  Select an account and an instance to launch.
                </div>
              )}
              <button
                type="button"
                onClick={onLaunchClick}
                className={`flex items-center rounded-lg font-medium px-5 py-2 bg-sky-400 text-white ${launchButtonDisabled ? "opacity-80 cursor-not-allowed" : "hover:bg-sky-500 active:bg-sky-600"}`}
                disabled={launchButtonDisabled !== null}
              >
                {launchButtonDisabled === "launching" && <Spin blackRing />}
                Launch
              </button>
            </div>
          </section>
        </main>

        <footer className="rounded-xl border border-gray-300 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <p>
            Epherome is currently unstable and incomplete, with many potential
            bugs.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div>
              User guides:{" "}
              <Link target="https://epherome.com">epherome.com</Link>
            </div>
            <div>
              Open source:{" "}
              <Link target="https://github.com/Epheromeers/Epherome">
                GitHub
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
