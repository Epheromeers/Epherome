import { FileDown, FilePlus } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";
import InstanceDownloaderView from "./InstanceDownloaderView";
import InstanceEditorView from "./InstanceEditorView";

export default function InstancesView() {
  const [instances, setInstances] = useState(configStore.data.instances);
  const currentInstance = instances.find((i) => i.checked);
  const [circumstance, setCircumstance] = useState<
    undefined | "creating" | "downloading"
  >();

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 p-2 space-y-1">
        <div className="flex justify-center">
          <IconButton onClick={() => setCircumstance("creating")}>
            <FilePlus />
          </IconButton>
          <IconButton onClick={() => setCircumstance("downloading")}>
            <FileDown />
          </IconButton>
        </div>
        {instances.map((instance) => (
          <button
            type="button"
            className={`block py-1 px-3 text-sm font-medium w-full rounded text-left ${instance.checked ? "bg-gray-100" : "hover:bg-gray-100 active:bg-gray-200"}`}
            onClick={() => {
              const former = instance.checked;
              configStore.data.instances.forEach((instance) => {
                instance.checked = false;
              });
              if (!former) instance.checked = true;
              saveConfig();
              setInstances(Array.from(configStore.data.instances));
            }}
            key={instance.id}
          >
            {instance.name}
          </button>
        ))}
      </div>
      <div className="w-4/5">
        {circumstance === "creating" ? (
          <InstanceEditorView
            onBack={() => {
              setCircumstance(undefined);
              setInstances(Array.from(configStore.data.instances));
            }}
          />
        ) : circumstance === "downloading" ? (
          <InstanceDownloaderView
            onBack={() => {
              setCircumstance(undefined);
              setInstances(Array.from(configStore.data.instances));
            }}
          />
        ) : currentInstance ? (
          <div className="p-4 space-y-2">
            <Label title="Name">{currentInstance.name}</Label>
            <Label title="Directory">{currentInstance.directory}</Label>
            <Label title="Version">{currentInstance.version}</Label>
            <Button
              onClick={() => {
                configStore.data.instances = configStore.data.instances.filter(
                  (instance) => instance.name !== currentInstance.name,
                );
                saveConfig();
                setInstances(configStore.data.instances);
              }}
              danger
            >
              Delete
            </Button>
          </div>
        ) : (
          <div>No instance selected</div>
        )}
      </div>
    </div>
  );
  /*
  return (
    <div>
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => app.setView("instanceEditor")}>Create</Button>
        <Button onClick={() => app.setView("instanceDownloader")}>
          Download
        </Button>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {instances.map((value) => (
          <Card key={value.name}>
            <div className="text-sm font-medium">{value.name}</div>
            <Label title="Directory">{value.directory}</Label>
            <Label title="Version">{value.version}</Label>
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
  */
}
