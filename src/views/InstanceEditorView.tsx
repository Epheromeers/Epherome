import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import { configStore } from "../config";
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
    <div>
      <div>
        <Button onClick={onBack}>Back</Button>
      </div>
      <div>
        <Input value={name} placeholder="Instance Name" onChange={setName} />
      </div>
      <div>
        <Input
          value={directory}
          placeholder="Instance Directory"
          onChange={setDirectory}
        />
      </div>
      <div>
        <Input
          value={version}
          placeholder="Instance Version"
          onChange={setVersion}
        />
      </div>
      <div className="flex">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              onBack();
              configStore.instances.push({
                name,
                directory,
                version,
              });
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
