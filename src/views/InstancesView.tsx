import { FileDown, FilePlus } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
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
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1 overflow-auto">
        <div className="flex justify-center">
          <IconButton onClick={() => setCircumstance("creating")}>
            <FilePlus />
          </IconButton>
          <IconButton onClick={() => setCircumstance("downloading")}>
            <FileDown />
          </IconButton>
        </div>
        {instances.map((instance) => (
          <ListItem
            checked={instance.checked}
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
          </ListItem>
        ))}
      </div>
      <div className="w-4/5 overflow-auto">
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
}
