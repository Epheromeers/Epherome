import { app, path } from "@tauri-apps/api";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
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

  const [javaPath, setJavaPath] = useState(data.settings.javaPath);
  const [meta, setMeta] = useState({
    appVersion: "Loading",
    appDir: "Loading",
  });

  useEffect(() => {
    getMeta().then(setMeta);
  }, []);

  return (
    <div className="space-y-3 p-4">
      <Label
        title="Java Path"
        helper="Java is required to launch Minecraft. The path to Java executive file usually ends with 'java' on macOS and Linux, ends with 'java.exe' on Windows."
        className="flex items-center space-x-1"
      >
        <Input
          placeholder="Path to Java Executive File"
          value={javaPath}
          onChange={setJavaPath}
        />
        <Button
          onClick={() =>
            app.setData((prev) => {
              prev.settings.javaPath = javaPath;
            })
          }
        >
          Save
        </Button>
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
