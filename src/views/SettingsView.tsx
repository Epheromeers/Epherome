import { app, path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import { CircleSlash, CircleX, Plus, Save } from "lucide-react";
import { nanoid } from "nanoid";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import Link from "../components/Link";
import RadioButton from "../components/RadioButton";
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
        {data.settings.javaRuntimes?.map((rt) => (
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
              className={`flex rounded items-center space-x-2 py-1 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${rt.checked && "bg-gray-100 dark:bg-gray-700"}`}
            >
              <div className="font-medium">{rt.nickname}</div>
              <div className="text-gray-600 dark:text-gray-300">
                {rt.pathname}
              </div>
              <div>(Java Version: {rt.version ?? "Unknown"})</div>
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
        )) ?? <div>No java runtimes.</div>}
        {newJava && (
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
            <Button
              onClick={() => {
                if (newJavaPath) {
                  invoke("get_java_version", { javaPath: newJavaPath })
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
        )}
        <div>
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
      <Label
        title="Instance Page Style"
        helper="This option will not have actual effects currently."
      >
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
