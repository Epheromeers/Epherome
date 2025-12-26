import { nanoid } from "nanoid";
import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";

export default function InstanceEditorView(props: {
  onBack: () => void;
  previous?: MinecraftInstance;
}) {
  const app = useContext(AppContext);
  const prev = props.previous;

  const [name, setName] = useState(prev?.name ?? String());
  const [directory, setDirectory] = useState(prev?.directory ?? String());
  const [version, setVersion] = useState(prev?.version ?? String());

  const onBack = () => {
    props.onBack();
  };

  return (
    <div className="space-y-3 p-4">
      <div className="text-lg font-medium pl-3">
        {prev ? "Edit Minecraft Instance" : "Create a new Minecraft Instance"}
      </div>
      <Label title="Name">
        <Input value={name} placeholder="Name" onChange={setName} />
      </Label>
      <Label
        title="Directory"
        helper="Usually 'minecraft' on macOS and Linux, '.minecraft' on Windows."
      >
        <Input
          value={directory}
          placeholder="Directory"
          onChange={setDirectory}
        />
      </Label>
      <Label
        title="Version"
        helper="The name of a folder in the versions directory."
      >
        <Input value={version} placeholder="Version" onChange={setVersion} />
      </Label>
      <div className="flex space-x-1 pl-3">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name && directory && version && !prev) {
              app.setData((prevData) => {
                prevData.instances.push({
                  id: nanoid(),
                  timestamp: Date.now(),
                  name,
                  directory,
                  version,
                });
              });
              onBack();
            } else {
              app.setData((prevData) => {
                const prevInstance = prevData.instances.find(
                  (i) => i.id === prev?.id,
                );
                if (prevInstance) {
                  prevInstance.name = name;
                  prevInstance.directory = directory;
                  prevInstance.version = version;
                }
              });
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
