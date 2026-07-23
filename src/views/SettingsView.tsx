import { app, path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import {
  CircleSlash,
  CircleX,
  Copy,
  FolderOpen,
  FolderSearch,
  LoaderCircle,
  Plus,
  Radar,
  RefreshCw,
  Save,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import Link from "../components/Link";
import RadioButton from "../components/RadioButton";
import { detectJavas, getJavaVersion } from "../core/java";
import { checkForUpdates } from "../core/update";
import { AppContext } from "../store";

async function getMeta() {
  const appVersion = await app.getVersion();
  const appDir = await path.appDataDir();
  return { appVersion, appDir };
}

export default function SettingsView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const [meta, setMeta] = useState({
    appVersion: "Loading",
    appDir: "Loading",
  });
  const [newJava, setNewJava] = useState(false);
  const [newJavaNickname, setNewJavaNickname] = useState("");
  const [newJavaPath, setNewJavaPath] = useState("");
  const [newJavaError, setNewJavaError] = useState<string>();
  const [savingJava, setSavingJava] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);

  const javaRuntimes = data.settings.javaRuntimes ?? [];
  const hasSelectedJava = javaRuntimes.some((rt) => rt.checked);

  useEffect(() => {
    getMeta().then(setMeta);
  }, []);

  function closeNewJavaForm() {
    setNewJava(false);
    setNewJavaNickname("");
    setNewJavaPath("");
    setNewJavaError(undefined);
  }

  async function saveNewJava() {
    const javaPath = newJavaPath.trim();

    if (!javaPath) {
      setNewJavaError("Choose a Java executable before saving.");
      return;
    }

    if (javaRuntimes.some((rt) => rt.pathname === javaPath)) {
      setNewJavaError("This Java runtime is already in the list.");
      return;
    }

    setNewJavaError(undefined);
    setSavingJava(true);

    try {
      const javaVersion = await getJavaVersion(javaPath);
      const newRt = {
        id: nanoid(),
        nickname: newJavaNickname.trim() || undefined,
        pathname: javaPath,
        version: javaVersion,
      };
      app.setData((prev) => {
        if (prev.settings.javaRuntimes) {
          prev.settings.javaRuntimes.push(newRt);
        } else {
          prev.settings.javaRuntimes = [newRt];
        }
      });
      closeNewJavaForm();
    } catch (err) {
      setNewJavaError(`Could not run this Java executable: ${err}`);
    } finally {
      setSavingJava(false);
    }
  }

  async function handleCheckForUpdates() {
    setCheckingForUpdates(true);

    try {
      const result = await checkForUpdates(meta.appVersion);
      if (result.updateAvailable) {
        app.openDialog({
          title: "Update Available",
          message: `Epherome ${result.latestVersion} is available. You are using ${result.currentVersion}. Open GitHub Releases to download and install the update.`,
          actionMessage: "Open GitHub",
          action: () => {
            openUrl(result.releaseUrl);
          },
        });
      } else {
        app.openToast({
          category: "success",
          content: `Epherome ${result.currentVersion} is up to date`,
        });
      }
    } catch (err) {
      app.openDialog({
        title: "Update Check Failed",
        message: `${err}`,
      });
    } finally {
      setCheckingForUpdates(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      <Label title="Java Manager" className="space-y-3">
        <div className="space-y-1">
          <div className="text-xs text-gray-500 dark:text-gray-300">
            Java is required to launch Minecraft. You can add and manage
            multiple runtimes here.
          </div>
          {!hasSelectedJava && (
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
              No default runtime is selected. Epherome will use &quot;java&quot;
              from PATH.
            </div>
          )}
        </div>
        {javaRuntimes.length > 0 ? (
          javaRuntimes.map((rt) => (
            <div
              key={rt.id}
              className={`flex min-w-0 items-center gap-1 rounded-lg border p-1 ${rt.checked ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40" : "border-gray-300 dark:border-gray-700"}`}
            >
              <button
                type="button"
                onClick={() => {
                  app.setData((prev) => {
                    const target = prev.settings.javaRuntimes?.find(
                      (nextRt) => nextRt.id === rt.id,
                    );
                    const former = target?.checked;
                    prev.settings.javaRuntimes?.forEach((nextRt) => {
                      nextRt.checked = false;
                    });
                    if (!former && target) {
                      target.checked = true;
                    }
                  });
                }}
                className={`min-w-0 grow rounded-md px-3 py-2 text-left focus:outline-none focus:ring-2 ring-blue-500 ${rt.checked ? "hover:bg-blue-100 active:bg-blue-200 dark:hover:bg-blue-900 dark:active:bg-blue-800" : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-sm font-medium">
                    {rt.nickname || "Java Runtime"}
                  </div>
                  <div className="shrink-0 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    {rt.version ?? "Unknown version"}
                  </div>
                  {rt.checked && (
                    <div className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                      Default
                    </div>
                  )}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-gray-500 dark:text-gray-300">
                  {rt.pathname}
                </div>
              </button>
              <IconButton
                title="Copy Java Path"
                tinted={rt.checked}
                tooltipPlacement="bottom-left"
                onClick={() =>
                  navigator.clipboard
                    .writeText(rt.pathname)
                    .then(() => {
                      app.openToast({
                        category: "success",
                        content: "Java path copied",
                      });
                    })
                    .catch((err) => {
                      app.openDialog({
                        title: "Copy Failed",
                        message: `${err}`,
                      });
                    })
                }
              >
                <Copy size={16} />
              </IconButton>
              <IconButton
                title="Remove Java Runtime"
                tinted={rt.checked}
                tooltipPlacement="bottom-left"
                onClick={() =>
                  app.setData((prev) => {
                    prev.settings.javaRuntimes =
                      prev.settings.javaRuntimes?.filter(
                        (nextRt) => nextRt.id !== rt.id,
                      );
                  })
                }
              >
                <CircleX size={16} />
              </IconButton>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
            No Java runtimes have been added yet.
          </div>
        )}
        {newJava && (
          <div className="space-y-3 rounded-lg border border-gray-300 p-3 dark:border-gray-700">
            <div>
              <div className="text-sm font-medium">Add Java Runtime</div>
              <div className="text-xs text-gray-500 dark:text-gray-300">
                Select a Java executable. Epherome will verify it before saving.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="space-y-1">
                <label
                  htmlFor="new-java-nickname"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Nickname <span className="font-normal">(optional)</span>
                </label>
                <Input
                  id="new-java-nickname"
                  value={newJavaNickname}
                  onChange={(value) => {
                    setNewJavaNickname(value);
                    setNewJavaError(undefined);
                  }}
                  placeholder="e.g. Java 21"
                  className="w-full"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <label
                  htmlFor="new-java-path"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Java executable
                </label>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id="new-java-path"
                    value={newJavaPath}
                    onChange={(value) => {
                      setNewJavaPath(value);
                      setNewJavaError(undefined);
                    }}
                    placeholder="Path to Java executable"
                    spellCheck={false}
                    className="min-w-0 grow font-mono"
                  />
                  <Button
                    disabled={savingJava}
                    onClick={() => {
                      open({
                        directory: false,
                        multiple: false,
                      }).then((value) => {
                        if (value) {
                          setNewJavaPath(value);
                          setNewJavaError(undefined);
                        }
                      });
                    }}
                  >
                    <FolderSearch size={16} />
                    <div>Browse</div>
                  </Button>
                </div>
              </div>
            </div>
            {newJavaError && (
              <div
                role="alert"
                className="wrap-break-word text-xs font-medium text-red-600 dark:text-red-400"
              >
                {newJavaError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={savingJava || !newJavaPath.trim()}
                onClick={saveNewJava}
              >
                {savingJava ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                <div>{savingJava ? "Testing..." : "Test and Save"}</div>
              </Button>
              <Button
                secondary
                disabled={savingJava}
                onClick={closeNewJavaForm}
              >
                <CircleSlash size={16} />
                <div>Cancel</div>
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setDetecting(true);
              detectJavas()
                .then((detected) => {
                  setDetecting(false);
                  const existingPaths = new Set(
                    data.settings.javaRuntimes?.map((rt) => rt.pathname),
                  );
                  const newRuntimes = detected.filter(
                    (rt) => !existingPaths.has(rt.pathname),
                  );
                  if (newRuntimes.length > 0) {
                    app.setData((prev) => {
                      if (prev.settings.javaRuntimes) {
                        prev.settings.javaRuntimes.push(...newRuntimes);
                      } else {
                        prev.settings.javaRuntimes = newRuntimes;
                      }
                      const hasChecked = prev.settings.javaRuntimes.some(
                        (rt) => rt.checked,
                      );
                      if (
                        !hasChecked &&
                        prev.settings.javaRuntimes.length > 0
                      ) {
                        prev.settings.javaRuntimes[0].checked = true;
                      }
                    });
                  }
                  const skipped = detected.length - newRuntimes.length;
                  app.openDialog({
                    title: "Detection Complete",
                    message:
                      newRuntimes.length > 0
                        ? `Found ${newRuntimes.length} new Java runtime${newRuntimes.length > 1 ? "s" : ""}.${skipped > 0 ? ` ${skipped} duplicate${skipped > 1 ? "s" : ""} skipped.` : ""}`
                        : detected.length > 0
                          ? "All detected Java runtimes are already in the list."
                          : "No Java runtimes found on this system.",
                  });
                })
                .catch((err) => {
                  setDetecting(false);
                  app.openDialog({
                    title: "Detection Failed",
                    message: `${err}`,
                  });
                });
            }}
            disabled={detecting}
          >
            <Radar size={16} />
            <div>Detect Java Runtimes</div>
          </Button>
          <Button
            disabled={newJava}
            onClick={() => {
              setNewJavaError(undefined);
              setNewJava(true);
            }}
          >
            <Plus size={16} />
            <div>Add Java Runtime</div>
          </Button>
        </div>
      </Label>
      <Label title="Color Theme">
        <RadioButton
          checked={data.settings.theme === "light"}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.theme = "light";
            });
          }}
        >
          Light
        </RadioButton>
        <RadioButton
          checked={data.settings.theme === "dark"}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.theme = "dark";
            });
          }}
        >
          Dark
        </RadioButton>
        <RadioButton
          checked={data.settings.theme === "system"}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.theme = "system";
            });
          }}
        >
          System
        </RadioButton>
      </Label>
      <Label title="Instance Page Style">
        <RadioButton
          checked={data.settings.independentInstance}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.independentInstance = true;
            });
          }}
        >
          Keep Instances Independent
        </RadioButton>
        <RadioButton
          checked={!data.settings.independentInstance}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.independentInstance = false;
            });
          }}
        >
          Put Instances with the Same Game Directory Together
        </RadioButton>
      </Label>
      <Label title="Developer Tools">
        <RadioButton
          checked={data.settings.developerTools}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.developerTools = true;
            });
          }}
        >
          On
        </RadioButton>
        <RadioButton
          checked={!data.settings.developerTools}
          onClick={() => {
            app.setData((prev) => {
              prev.settings.developerTools = false;
            });
          }}
        >
          Off
        </RadioButton>
      </Label>
      <Label title="App Version" className="space-y-1">
        <div>{meta.appVersion}</div>
        <Button
          disabled={checkingForUpdates || meta.appVersion === "Loading"}
          onClick={handleCheckForUpdates}
        >
          {checkingForUpdates ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          <div>{checkingForUpdates ? "Checking..." : "Check for Updates"}</div>
        </Button>
      </Label>
      <Label
        title="App Data Directory"
        afterTitle={
          <div className="flex items-center space-x-1">
            <IconButton
              small
              title="Reveal App Data Directory"
              onClick={() => openPath(meta.appDir)}
            >
              <FolderOpen size={12} />
            </IconButton>
            <IconButton
              small
              title="Copy Directory Path"
              onClick={() =>
                navigator.clipboard
                  .writeText(meta.appDir)
                  .then(() => {
                    app.openToast({
                      category: "success",
                      content: "Copied successfully",
                    });
                  })
                  .catch((err) => {
                    app.openDialog({
                      title: "Error",
                      message: `${err}`,
                    });
                  })
              }
            >
              <Copy size={12} />
            </IconButton>
          </div>
        }
      >
        {meta.appDir}
      </Label>
      <Label title="OS">
        {platform()} {version()} {arch()}
      </Label>
      <Label title="GitHub Repository">
        <Link target="https://github.com/Epheromeers/Epherome">
          https://github.com/Epheromeers/Epherome
        </Link>
      </Label>
      <Label title="Official Website">
        <Link target="https://epherome.com">https://epherome.com</Link>
      </Label>
    </div>
  );
}
