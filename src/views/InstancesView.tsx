import { path } from "@tauri-apps/api";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  ChevronDown,
  ChevronRight,
  FileDown,
  FilePlus,
  Pencil,
} from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import TabButton from "../components/TabButton";
import type { MinecraftVersion } from "../core/download";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";
import { readDir } from "../utils/fs";
import InstanceDownloaderView from "./InstanceDownloaderView";
import InstanceEditorView from "./InstanceEditorView";
import InstanceInstallerView from "./InstanceInstallerView";
import InstanceModLoaderView from "./InstanceModLoaderView";

function shortenDirectory(directory: string): string {
  const sep = directory.includes("\\") ? "\\" : "/";
  const segments = directory.split(sep).filter((s) => s.length > 0);
  if (segments.length <= 2) return segments.join("/");
  return segments.slice(-2).join("/");
}

function InstanceGroup(props: {
  directory: string;
  instances: MinecraftInstance[];
  onSelect: (instance: MinecraftInstance) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        type="button"
        className="flex items-center w-full py-1 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={14} className="mr-1 shrink-0" />
        ) : (
          <ChevronRight size={14} className="mr-1 shrink-0" />
        )}
        <span className="truncate">{shortenDirectory(props.directory)}</span>
      </button>
      {expanded && (
        <div className="ml-2">
          {props.instances.map((instance) => (
            <ListItem
              checked={instance.checked}
              onClick={() => props.onSelect(instance)}
              key={instance.id}
            >
              {instance.name}
            </ListItem>
          ))}
        </div>
      )}
    </div>
  );
}

function InstanceModViewer(props: { instance: MinecraftInstance }) {
  const current = props.instance;
  const [modsPath, setModsPath] = useState<string>();
  const [modList, setModList] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    path.join(current.directory, "mods").then((modsPath) => {
      setModsPath(modsPath);
      readDir(modsPath).then((files) =>
        setModList(files.map((f) => f.name).filter((n) => n.endsWith(".jar"))),
      );
    });
  }, [current]);

  return (
    <div className="p-4 space-y-2">
      <div className="flex space-x-2">
        <Button onClick={() => modsPath && openPath(modsPath)}>
          Reveal Mods Directory
        </Button>
      </div>
      <div className="space-y-1">
        {modList.map((mod) => (
          <ListItem
            checked={selected === mod}
            key={mod}
            onClick={() => setSelected(mod)}
          >
            {mod}
          </ListItem>
        ))}
      </div>
    </div>
  );
}

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
  const [option, setOption] = useState<"general" | "mods">("general");

  const onBack = () => setShowing("list");

  const selectInstance = (instance: MinecraftInstance) => {
    if (showing === "list") {
      app.setData((prevData) => {
        const former = prevData.instances.find(
          (i) => i.id === instance.id,
        )?.checked;
        prevData.instances.forEach((i) => {
          i.checked = false;
        });
        if (!former) {
          const target = prevData.instances.find((i) => i.id === instance.id);
          if (target) target.checked = true;
        }
      });
    }
  };

  const grouped = useMemo(() => {
    if (data.settings.independentInstance) return null;
    const map = new Map<string, MinecraftInstance[]>();
    for (const instance of data.instances) {
      const group = map.get(instance.directory);
      if (group) group.push(instance);
      else map.set(instance.directory, [instance]);
    }
    return [...map.entries()];
  }, [data.instances, data.settings.independentInstance]);

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
        {grouped
          ? grouped.map(([directory, instances]) => (
              <InstanceGroup
                directory={directory}
                instances={instances}
                onSelect={selectInstance}
                key={directory}
              />
            ))
          : data.instances.map((instance) => (
              <ListItem
                checked={instance.checked}
                onClick={() => selectInstance(instance)}
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
            <div>
              <div className="flex space-x-2 p-4">
                <TabButton
                  active={option === "general"}
                  onClick={() => setOption("general")}
                >
                  General
                </TabButton>
                <TabButton
                  active={option === "mods"}
                  onClick={() => setOption("mods")}
                >
                  Mods
                </TabButton>
              </div>
              {option === "general" ? (
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
                  <Button onClick={() => openPath(current.directory)}>
                    Reveal Game Directory
                  </Button>
                  <Button onClick={() => setShowing("modLoader")}>
                    Add Mod Loader
                  </Button>
                </div>
              ) : (
                <InstanceModViewer instance={current} />
              )}
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
