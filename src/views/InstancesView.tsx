import { FileDown, FilePlus, Pencil } from "lucide-react";
import { useContext, useState } from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import type { MinecraftVersion } from "../core/download";
import { AppContext } from "../store";
import InstanceDownloaderView from "./InstanceDownloaderView";
import InstanceEditorView from "./InstanceEditorView";
import InstanceInstallerView from "./InstanceInstallerView";
import { InstanceModLoaderView } from "./InstanceModLoaderView";

export default function InstancesView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const current = data.instances.find((i) => i.checked);
  const [currentVersion, setCurrentVersion] = useState<
    MinecraftVersion | undefined
  >();
  const [showing, setShowing] = useState<
    "list" | "create" | "download" | "edit" | "install" | "modLoader"
  >("list");

  const onBack = () => setShowing("list");

  const onDelete = () => {
    if (current) {
      app.openDialog({
        title: "Delete Instance",
        message: `Are you sure you want to delete the instance '${current.name}'? This action cannot be undone.`,
        action: () => {
          app.setData((prevData) => {
            prevData.instances = prevData.instances.filter(
              (instance) => instance.id !== current.id,
            );
          });
        },
        danger: true,
        actionMessage: "Delete",
      });
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1 overflow-auto">
        <div className="flex justify-center">
          <IconButton onClick={() => setShowing("create")}>
            <FilePlus />
          </IconButton>
          <IconButton onClick={() => setShowing("download")}>
            <FileDown />
          </IconButton>
        </div>
        {data.instances.map((instance) => (
          <ListItem
            checked={instance.checked}
            onClick={() => {
              if (showing === "list") {
                app.setData((prevData) => {
                  const former = instance.checked;
                  prevData.instances.forEach((instance) => {
                    instance.checked = false;
                  });
                  if (!former) instance.checked = true;
                });
              }
            }}
            key={instance.id}
          >
            {instance.name}
          </ListItem>
        ))}
      </div>
      <div className="w-4/5 overflow-auto">
        {showing === "create" && <InstanceEditorView onBack={onBack} />}
        {showing === "download" && (
          <InstanceDownloaderView
            onBack={(version) => {
              if (version) {
                setCurrentVersion(version);
                setShowing("install");
              } else setShowing("list");
            }}
          />
        )}
        {showing === "edit" && (
          <InstanceEditorView previous={current} onBack={onBack} />
        )}
        {showing === "install" && currentVersion && (
          <InstanceInstallerView version={currentVersion} onBack={onBack} />
        )}
        {showing === "modLoader" && current && (
          <InstanceModLoaderView current={current} onBack={onBack} />
        )}
        {showing === "list" &&
          (current ? (
            <div className="p-4 space-y-2">
              <Label title="Name">{current.name}</Label>
              <Label title="Directory">{current.directory}</Label>
              <Label title="Version">{current.version}</Label>
              <div className="flex space-x-2">
                <Button onClick={() => setShowing("edit")}>
                  <Pencil size={16} />
                  <div>Edit</div>
                </Button>
                <Button onClick={onDelete} danger>
                  Delete
                </Button>
              </div>
              <Button onClick={() => setShowing("modLoader")}>
                Add Mod Loader
              </Button>
            </div>
          ) : (
            <Center className="h-full">
              Choose an instance on the list to view details.
            </Center>
          ))}
      </div>
    </div>
  );
}
