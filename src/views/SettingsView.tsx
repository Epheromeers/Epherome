import { app, path } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import Helper from "../components/Helper";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";

export default function SettingsView() {
  const [javaPath, setJavaPath] = useState(configStore.data.javaPath);
  const [meta, setMeta] = useState({
    appVersion: "Loading",
    appDir: "Loading",
  });

  useEffect(() => {
    app.getVersion().then((appVersion) => {
      path.appDataDir().then((appDir) => {
        setMeta({ appVersion, appDir });
      });
    });
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <Label>Java Path</Label>
        <div className="flex items-center space-x-1">
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
        </div>
        <Helper>
          Java is required to launch Minecraft. The path to Java executive file
          usually ends with "java" on macOS and Linux, ends with "java.exe" on
          Windows.
        </Helper>
      </div>
      <div>
        <Label>App Version</Label>
        <div className="text-sm pl-3">Epherome {meta.appVersion}</div>
      </div>
      <div>
        <Label>App Data Directory</Label>
        <div className="text-sm pl-3">{meta.appDir}</div>
      </div>
      <div>
        <Label>GitHub Repository</Label>
        <div className="text-sm pl-3">
          https://github.com/Epheromeers/Epherome
        </div>
      </div>
    </div>
  );
}
