import { path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import {
  ChevronLeft,
  ChevronUp,
  FolderSearch,
  FolderSync,
  Save,
  ScrollText,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useContext, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";
import { applyIgnore } from "../utils";
import { exists, readDir } from "../utils/fs";

export default function InstanceEditorView(props: {
  onBack: () => void;
  previous?: MinecraftInstance;
}) {
  const app = useContext(AppContext);
  const prev = props.previous;

  const [name, setName] = useState(prev?.name ?? String());
  const [directory, setDirectory] = useState(prev?.directory ?? String());
  const [version, setVersion] = useState(prev?.version ?? String());
  const [errorMessage, setErrorMessage] = useState(String());
  const [versionList, setVersionList] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const onSave = () => {
    if (name && directory && version) {
      if (prev) {
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
      } else {
        app.setData((prevData) => {
          prevData.instances.push({
            id: nanoid(),
            timestamp: Date.now(),
            name,
            directory,
            version,
          });
        });
      }
      props.onBack();
    } else {
      setErrorMessage("Please fill in all fields.");
    }
  };

  const onList = async () => {
    if (directory) {
      const versionDirectory = await path.join(directory, "versions");
      if (await exists(versionDirectory)) {
        const entries = await readDir(versionDirectory);
        setVersionList(
          applyIgnore(entries, [
            ".DS_Store",
            "version_manifest.json",
            "version_manifest_v2.json",
            "jre_manifest.json",
          ]),
        );
        setShowDropdown(true);
      } else {
        app.openDialog({
          title: "Error Occurred",
          message: `The versions directory does not exist at the specified path: ${versionDirectory}`,
        });
      }
    } else {
      app.openDialog({
        title: "Error Occurred",
        message: "Please fill in the directory field before listing versions.",
      });
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
          helper="Usually 'minecraft' on macOS, '.minecraft' on Windows and Linux."
          accentHelper="Click 'Default' to fill in the default game directory for your platform."
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
          <Button
            onClick={() => {
              const platformName = platform();
              path.homeDir().then((home) => {
                if (platformName === "macos") {
                  path
                    .join(home, "Library", "Application Support", "minecraft")
                    .then(setDirectory);
                } else if (platformName === "linux") {
                  path.join(home, ".minecraft").then(setDirectory);
                } else if (platformName === "windows") {
                  path
                    .join(home, "AppData", "Roaming", ".minecraft")
                    .then(setDirectory);
                }
              });
            }}
          >
            <FolderSync size={16} />
            <div>Default</div>
          </Button>
        </Label>
        <Label
          title="Version"
          helper="The name of a folder in the versions directory."
          accentHelper="Click 'List' to see available versions of the given game directory."
          className="flex space-x-2"
        >
          <Input value={version} placeholder="Version" onChange={setVersion} />
          <Button onClick={onList}>
            <ScrollText size={16} />
            <div>List</div>
          </Button>
          {showDropdown && versionList && (
            <div className="absolute z-10 mt-8 bg-gray-100 dark:bg-gray-700 rounded shadow-lg">
              {versionList.map((ver) => (
                <button
                  className="flex w-full px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                  type="button"
                  onClick={() => {
                    setVersion(ver);
                    setShowDropdown(false);
                  }}
                  key={ver}
                >
                  {ver}
                </button>
              ))}
              <button
                type="button"
                className="rounded hover:bg-gray-300 dark:hover:bg-gray-500 p-2"
                onClick={() => setShowDropdown(false)}
              >
                <ChevronUp />
              </button>
            </div>
          )}
        </Label>
        <div className="py-2">
          <Button onClick={onSave}>
            <Save size={16} />
            <div>Save</div>
          </Button>
          {errorMessage && (
            <div className="text-red-500 text-sm">{errorMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
