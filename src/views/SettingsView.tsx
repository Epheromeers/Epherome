import { app, path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import {
  CircleSlash,
  CircleX,
  FolderSearch,
  Plus,
  Radar,
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
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    getMeta().then(setMeta);
  }, []);

  return (
    <div className="space-y-3 p-4">
      <Label
        title="Java Manager"
        helper="Java is required to launch Minecraft. You can add multiple Java runtimes here."
        accentHelper="Please keep a Java Runtime selected, otherwise the launcher will use 'java' as default executable path."
        className="space-y-2"
      >
        {(data.settings.javaRuntimes?.length ?? 0) > 0 ? (
          data.settings.javaRuntimes?.map((rt) => (
            <div key={rt.id} className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const former = rt.checked;
                  app.setData((prev) => {
                    prev.settings.javaRuntimes?.forEach((nextRt) => {
                      nextRt.checked = false;
                    });
                    if (!former) {
                      rt.checked = true;
                    }
                  });
                }}
                className={`flex grow rounded items-center space-x-2 py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${rt.checked && "bg-gray-100 dark:bg-gray-700"}`}
              >
                {rt.nickname && (
                  <div className="font-medium">{rt.nickname}</div>
                )}
                <div className="rounded bg-blue-400 text-white px-1.5 py-0.5 text-xs font-medium">
                  {rt.version ?? "Unknown"}
                </div>
                <div className="text-gray-600 dark:text-gray-300 text-sm truncate">
                  {rt.pathname}
                </div>
              </button>
              <IconButton
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
          <div>No java runtimes.</div>
        )}
        {newJava && (
          <div className="rounded border border-gray-300 dark:border-gray-700 p-3 space-y-2">
            <div className="text-sm font-medium">Add Java Runtime</div>
            <div className="flex space-x-2">
              <Input
                value={newJavaNickname}
                onChange={setNewJavaNickname}
                placeholder="Nickname (Optional)"
              />
              <Input
                value={newJavaPath}
                onChange={setNewJavaPath}
                placeholder="Path to Java Executable"
                spellCheck={false}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  open({
                    directory: false,
                    multiple: false,
                  }).then((value) => {
                    if (value) setNewJavaPath(value);
                  });
                }}
              >
                <FolderSearch size={16} />
                <div>Browse</div>
              </Button>
              <Button
                onClick={() => {
                  if (newJavaPath) {
                    getJavaVersion(newJavaPath)
                      .then((javaVersion) => {
                        app.setData((prev) => {
                          const newRt = {
                            id: nanoid(),
                            nickname: newJavaNickname,
                            pathname: newJavaPath,
                            version: javaVersion as string,
                          };
                          if (prev.settings.javaRuntimes) {
                            prev.settings.javaRuntimes.push(newRt);
                          } else {
                            prev.settings.javaRuntimes = [newRt];
                          }
                        });
                        setNewJavaNickname("");
                        setNewJavaPath("");
                        setNewJava(false);
                      })
                      .catch((err) => {
                        app.openDialog({
                          title: "Java Test Failed",
                          message: `${err}`,
                        });
                      });
                  }
                }}
              >
                <Save size={16} />
                <div>Test and Save</div>
              </Button>
              <Button onClick={() => setNewJava(false)}>
                <CircleSlash size={16} />
                <div>Cancel</div>
              </Button>
            </div>
          </div>
        )}
        <div className="flex space-x-2 items-center">
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
          <Button onClick={() => setNewJava(true)}>
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
      <Label title="App Version">{meta.appVersion}</Label>
      <Label title="App Data Directory">{meta.appDir}</Label>
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
