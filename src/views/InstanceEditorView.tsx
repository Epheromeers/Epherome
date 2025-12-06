import { useContext, useState } from "react";
import Button from "../components/Button";
import Helper from "../components/Helper";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";
import { RouterContext } from "../router";

export default function InstanceEditorView() {
  const router = useContext(RouterContext);
  const [name, setName] = useState(String());
  const [directory, setDirectory] = useState(String());
  const [version, setVersion] = useState(String());

  const onBack = () => {
    router.setView("instances");
  };

  return (
    <div className="space-y-3">
      <div className="text-lg font-medium pl-3">
        Create a new Minecraft Instance
      </div>
      <div className="space-y-1 flex flex-col">
        <Label>Name</Label>
        <Input value={name} placeholder="Name" onChange={setName} />
      </div>
      <div className="space-y-1 flex flex-col">
        <Label>Directory</Label>
        <Input
          value={directory}
          placeholder="Directory"
          onChange={setDirectory}
        />
        <Helper>
          Usually "minecraft" on macOS and Linux, ".minecraft" on Windows.
        </Helper>
      </div>
      <div className="space-y-1 flex flex-col">
        <Label>Version</Label>
        <Input value={version} placeholder="Version" onChange={setVersion} />
        <Helper>The name of a folder in the versions directory.</Helper>
      </div>
      <div className="flex space-x-1 pl-3">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              configStore.data.instances.push({
                name,
                directory,
                version,
              });
              saveConfig();
              onBack();
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
