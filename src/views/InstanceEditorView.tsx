import { nanoid } from "nanoid";
import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import { AppContext } from "../store";

export default function InstanceEditorView(props: { onBack: () => void }) {
  const app = useContext(AppContext);

  const [name, setName] = useState(String());
  const [directory, setDirectory] = useState(String());
  const [version, setVersion] = useState(String());

  const onBack = () => {
    props.onBack();
  };

  return (
    <div className="space-y-3 p-4">
      <div className="text-lg font-medium pl-3">
        Create a new Minecraft Instance
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
            if (name) {
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
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
