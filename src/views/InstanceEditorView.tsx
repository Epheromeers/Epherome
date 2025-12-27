import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { useContext, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
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

  const onSave = () => {
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
      props.onBack();
    } else {
      app.setData((prevData) => {
        const prevInstance = prevData.instances.find((i) => i.id === prev?.id);
        if (prevInstance) {
          prevInstance.name = name;
          prevInstance.directory = directory;
          prevInstance.version = version;
        }
      });
      props.onBack();
    }
  };

  return (
    <div className="p-2">
      <div className="flex items-center space-x-2">
        <IconButton onClick={props.onBack}>
          <ChevronLeft />
        </IconButton>
        <div className="font-medium">Edit Minecraft Instance</div>
      </div>
      <div className="p-4 space-y-2">
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
        <div className="py-2">
          <Button onClick={onSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}
