import { useContext, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";
import { RouterContext } from "../router";

export default function InstancesView() {
  const [instances, setInstances] = useState(configStore.data.instances);
  const router = useContext(RouterContext);

  return (
    <div>
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => router.setView("instanceEditor")}>Create</Button>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {instances.map((value) => (
          <Card key={value.name}>
            <div className="text-sm font-medium">{value.name}</div>
            <div>
              <Label>Directory</Label>
              <div className="text-sm pl-3">{value.directory}</div>
            </div>
            <div>
              <Label>Version</Label>
              <div className="text-sm pl-3">{value.version}</div>
            </div>
            <div className="flex space-x-1 justify-end">
              <Button
                onClick={() => {
                  const former = value.checked;
                  configStore.data.instances.forEach((instance) => {
                    instance.checked = false;
                  });
                  if (!former) value.checked = true;
                  saveConfig();
                  setInstances(Array.from(configStore.data.instances));
                }}
              >
                {value.checked ? "Deselect" : "Select"}
              </Button>
              <Button
                onClick={() => {
                  configStore.data.instances =
                    configStore.data.instances.filter(
                      (instance) => instance.name !== value.name,
                    );
                  saveConfig();
                  setInstances(configStore.data.instances);
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
