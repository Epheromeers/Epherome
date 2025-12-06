import { useState } from "react";
import Button from "../components/Button";
import Helper from "../components/Helper";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore } from "../config";

export default function SettingsView() {
  const [javaPath, setJavaPath] = useState(configStore.javaPath);

  return (
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
            configStore.javaPath = javaPath;
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
  );
}
