import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft, FolderSearch, Save, ScrollText } from "lucide-react";
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

  const onBrowse = () => {
    open({
      directory: true,
      multiple: false,
    }).then((value) => setDirectory(value ?? String()));
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
          className="flex space-x-2"
        >
          <Input
            value={directory}
            placeholder="Directory"
            onChange={setDirectory}
          />
          <Button onClick={onBrowse}>
            <FolderSearch size={16} />
            <div>Browse</div>
          </Button>
        </Label>
        <Label
          title="Version"
          helper="The name of a folder in the versions directory."
          accentHelper="Click 'List' to see available versions of the given game directory."
          className="flex space-x-2"
        >
          <Input value={version} placeholder="Version" onChange={setVersion} />
          <Button>
            <ScrollText size={16} />
            <div>List</div>
          </Button>
        </Label>
        <div className="py-2">
          <Button onClick={onSave}>
            <Save size={16} />
            <div>Save</div>
          </Button>
        </div>
      </div>
    </div>
  );
}
