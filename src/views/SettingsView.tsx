import { app, path } from "@tauri-apps/api";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import Link from "../components/Link";
import RadioButton from "../components/RadioButton";
import { configStore, saveConfig } from "../config";
import { applyTheme } from "../config/theme";
import { AppContext } from "../store";

async function getMeta() {
  const appVersion = await app.getVersion();
  const appDir = await path.appDataDir();
  return { appVersion, appDir };
}

export default function SettingsView() {
  const app = useContext(AppContext);
  const [javaPath, setJavaPath] = useState(configStore.data.javaPath);
  const [theme, setTheme] = useState(configStore.data.theme);
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
        helper="Java is required to launch Minecraft. The path to Java executive fileusually ends with 'java' on macOS and Linux, ends with 'java.exe' onWindows."
        className="flex items-center space-x-1"
      >
        <Input
          placeholder="Path to Java Executive File"
          value={javaPath}
          onChange={setJavaPath}
        />
        <Button
          onClick={() => {
            configStore.data.javaPath = javaPath;
            saveConfig();
          }}
        >
          Save
        </Button>
      </Label>
      <Label title="Color Theme">
        <RadioButton
          checked={theme === "light"}
          onClick={() => {
            configStore.data.theme = "light";
            saveConfig();
            applyTheme();
            setTheme("light");
          }}
        >
          Light
        </RadioButton>
        <RadioButton
          checked={theme === "dark"}
          onClick={() => {
            configStore.data.theme = "dark";
            saveConfig();
            applyTheme();
            setTheme("dark");
          }}
        >
          Dark
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
      <Button
        onClick={() =>
          app.openDialog({
            title: "Test Dialog",
            message: "This is a test dialog from SettingsView.",
          })
        }
      >
        Test Dialog
      </Button>
    </div>
  );
}
