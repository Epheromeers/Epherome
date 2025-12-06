import { useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import { configStore } from "../config";

export default function SettingsView() {
  const [javaPath, setJavaPath] = useState(configStore.javaPath);

  return (
    <div>
      <div className="flex">
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
    </div>
  );
}
