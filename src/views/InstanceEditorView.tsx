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
import { useContext, useEffect, useRef, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import { listInstalledMinecraftVersions } from "../core/instances";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";

const versionListId = "available-version-list";

export default function InstanceEditorView(props: {
  onBack: () => void;
  previous?: MinecraftInstance;
}) {
  const app = useContext(AppContext);
  const data = app.getData();
  const prev = props.previous;

  const [name, setName] = useState(prev?.name ?? String());
  const [directory, setDirectory] = useState(prev?.directory ?? String());
  const [version, setVersion] = useState(prev?.version ?? String());
  const [javaId, setJavaId] = useState(prev?.javaId ?? String());
  const [errorMessage, setErrorMessage] = useState(String());
  const [versionList, setVersionList] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const versionPickerRef = useRef<HTMLDivElement>(null);
  const versionListRequestId = useRef(0);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !versionPickerRef.current?.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowDropdown(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showDropdown]);

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
            prevInstance.javaId = javaId || undefined;
          }
        });
      } else {
        const instance = {
          id: nanoid(),
          timestamp: Date.now(),
          name,
          directory,
          version,
          javaId: javaId || undefined,
        };
        app.setData((prevData) => {
          prevData.instances.push(instance);
        });
      }
      props.onBack();
    } else {
      setErrorMessage("Please fill in all fields.");
    }
  };

  const onDirectoryChange = (value: string) => {
    versionListRequestId.current += 1;
    setDirectory(value);
    setVersionList([]);
    setShowDropdown(false);
    setIsLoadingVersions(false);
  };

  const onList = async () => {
    if (showDropdown) {
      setShowDropdown(false);
      return;
    }

    const requestedDirectory = directory.trim();
    const requestId = ++versionListRequestId.current;
    setVersionList([]);
    setShowDropdown(false);

    if (!requestedDirectory) {
      app.openDialog({
        title: "Error Occurred",
        message: "Please fill in the directory field before listing versions.",
      });
      return;
    }

    setIsLoadingVersions(true);
    try {
      const versions = await listInstalledMinecraftVersions(requestedDirectory);
      if (requestId !== versionListRequestId.current) {
        return;
      }
      setVersionList(versions);
      setShowDropdown(true);
    } catch (err) {
      if (requestId !== versionListRequestId.current) {
        return;
      }
      app.openDialog({
        title: "Unable to List Versions",
        message: `${err}`,
      });
    } finally {
      if (requestId === versionListRequestId.current) {
        setIsLoadingVersions(false);
      }
    }
  };

  const onBrowse = async () => {
    try {
      const value = await open({
        directory: true,
        multiple: false,
      });
      if (typeof value === "string") {
        onDirectoryChange(value);
      }
    } catch (err) {
      app.openDialog({
        title: "Unable to Select Directory",
        message: `${err}`,
      });
    }
  };

  const onDefaultDirectory = async () => {
    try {
      const platformName = platform();
      const home = await path.homeDir();
      if (platformName === "macos") {
        onDirectoryChange(
          await path.join(home, "Library", "Application Support", "minecraft"),
        );
      } else if (platformName === "linux") {
        onDirectoryChange(await path.join(home, ".minecraft"));
      } else if (platformName === "windows") {
        onDirectoryChange(
          await path.join(home, "AppData", "Roaming", ".minecraft"),
        );
      }
    } catch (err) {
      app.openDialog({
        title: "Unable to Determine Default Directory",
        message: `${err}`,
      });
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
          <Input
            value={name}
            placeholder="Name"
            onChange={setName}
            className="w-full"
          />
        </Label>
        <Label
          title="Directory"
          helper="Usually 'minecraft' on macOS, '.minecraft' on Windows and Linux."
          accentHelper="Click 'Default' to fill in the default game directory for your platform."
          className="flex min-w-0 gap-2"
        >
          <Input
            value={directory}
            placeholder="Directory"
            onChange={onDirectoryChange}
            className="min-w-0 flex-1"
          />
          <Button onClick={onBrowse}>
            <FolderSearch size={16} />
            <div>Browse</div>
          </Button>
          <Button onClick={onDefaultDirectory}>
            <FolderSync size={16} />
            <div>Default</div>
          </Button>
        </Label>
        <Label
          title="Version"
          helper="The name of a folder in the versions directory."
          accentHelper="Click 'List' to see available versions of the given game directory."
        >
          <div ref={versionPickerRef} className="relative">
            <div className="flex min-w-0 gap-2">
              <Input
                value={version}
                placeholder="Version"
                onChange={setVersion}
                className="min-w-0 flex-1"
                ariaLabel="Minecraft version"
              />
              <Button
                onClick={onList}
                disabled={isLoadingVersions}
                ariaExpanded={showDropdown}
                ariaControls={showDropdown ? versionListId : undefined}
                ariaLabel={
                  isLoadingVersions
                    ? "Loading available versions"
                    : "List available versions"
                }
              >
                {showDropdown ? (
                  <ChevronUp size={16} />
                ) : (
                  <ScrollText size={16} />
                )}
                <div>{isLoadingVersions ? "Loading..." : "List"}</div>
              </Button>
            </div>
            {showDropdown && (
              <div
                id={versionListId}
                className="absolute inset-x-0 top-full z-20 mt-2 max-w-md overflow-hidden rounded-xl border border-gray-300 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Available Versions
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                      {versionList.length}
                    </span>
                  </div>
                  <IconButton
                    small
                    ariaLabel="Close version list"
                    onClick={() => setShowDropdown(false)}
                  >
                    <ChevronUp size={16} />
                  </IconButton>
                </div>
                <ul
                  className="max-h-56 space-y-1 overflow-x-hidden overflow-y-auto p-1.5"
                  aria-label="Available Minecraft versions"
                >
                  {versionList.length > 0 ? (
                    versionList.map((ver) => (
                      <li key={ver}>
                        <button
                          className={`flex w-full min-w-0 rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 ring-blue-500 ${
                            version === ver
                              ? "bg-blue-100 font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                              : "text-gray-700 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"
                          }`}
                          type="button"
                          aria-pressed={version === ver}
                          title={ver}
                          onClick={() => {
                            setVersion(ver);
                            setShowDropdown(false);
                          }}
                        >
                          <span className="truncate">{ver}</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div
                        className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300"
                        role="status"
                      >
                        No valid Minecraft versions found.
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </Label>
        <Label
          title="Java Runtime"
          helper="Optionally assign a specific Java runtime for this instance."
          accentHelper="Leave as 'Global Default' to use the globally selected Java runtime."
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setJavaId(String())}
              className={`rounded px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${!javaId ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""}`}
            >
              Global Default
            </button>
            {data.settings.javaRuntimes?.map((rt) => (
              <button
                type="button"
                key={rt.id}
                onClick={() => setJavaId(rt.id)}
                className={`flex items-center space-x-1.5 rounded px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${javaId === rt.id ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""}`}
              >
                <span className="shrink-0 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                  {rt.version ?? "Unknown version"}
                </span>
                <span>{rt.nickname || rt.pathname}</span>
              </button>
            ))}
          </div>
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
