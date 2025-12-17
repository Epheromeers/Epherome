import { app, path } from "@tauri-apps/api";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";

async function getMeta() {
  const appVersion = await app.getVersion();
  const appDir = await path.appDataDir();
  return { appVersion, appDir };
}

export default function SettingsView() {
  const [javaPath, setJavaPath] = useState(configStore.data.javaPath);
  const [meta, setMeta] = useState({
    appVersion: "Loading",
    appDir: "Loading",
  });

  useEffect(() => {
    getMeta().then(setMeta);
  }, []);

  return (
    <div className="space-y-3">
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
      <Label title="App Version">{meta.appVersion}</Label>
      <Label title="App Data Directory">{meta.appDir}</Label>
      <Label title="OS">
        {platform()} {version()} {arch()}
      </Label>
      <Label title="GitHub Repository">
        https://github.com/Epheromeers/Epherome
      </Label>
    </div>
  );
}
