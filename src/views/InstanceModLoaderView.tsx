import { fetch } from "@tauri-apps/plugin-http";
import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import Spin from "../components/Spin";
import { installFabric, prepareToInstallModLoader } from "../core/download";
import { AppContext } from "../store";
import type { MinecraftInstance } from "../store/data";

export function InstanceModLoaderView(props: {
  current: MinecraftInstance;
  onBack: () => void;
}) {
  // Step 0: Choose a mod loader
  // Step 1: Choose the mod loader version
  // Step 2: Install confirmation
  const [step, setStep] = useState(0);
  const [gameVersion, setGameVersion] = useState(String());
  const [errorMessage, setErrorMessage] = useState(String());
  const [modLoader, setModLoader] = useState(String());
  const [modLoaderVersions, setModLoaderVersions] = useState<string[]>([]);
  const [selectedModLoaderVersion, setSelectedModLoaderVersion] = useState(
    String(),
  );
  const [installing, setInstalling] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState(
    `${props.current.name} (Modded)`,
  );
  const app = useContext(AppContext);

  useEffect(() => {
    prepareToInstallModLoader(props.current)
      .then(({ gameVersion }) => setGameVersion(gameVersion))
      .catch((err) => setErrorMessage(`${err}`));
  }, [props.current]);

  const onChooseModLoader = (loader: string) => {
    setModLoader(loader);
    setStep(1);
    if (loader === "fabric") {
      fetch(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
        .then((resp) => resp.json())
        .then((data) =>
          setModLoaderVersions(
            data.map(
              (obj: { loader: { version: string } }) => obj.loader.version,
            ),
          ),
        );
    }
  };

  const onInstall = () => {
    if (modLoader === "fabric") {
      setInstalling(true);
      installFabric(props.current, gameVersion, selectedModLoaderVersion)
        .then((moddedId) => {
          app.setData((prev) => {
            prev.instances.push({
              id: nanoid(),
              name: newInstanceName,
              directory: props.current.directory,
              version: moddedId,
              timestamp: Date.now(),
              checked: false,
            });
          });
          props.onBack();
        })
        .catch((err) => {
          app.openDialog({
            title: "Error Occurred",
            message: `${err}`,
          });
          setInstalling(false);
        });
    }
  };

  return (
    <div className="p-2">
      <div className="flex space-x-2 items-center">
        <IconButton onClick={props.onBack}>
          <ChevronLeft />
        </IconButton>
        <div className="font-medium">Install Mod Loader</div>
      </div>
      {errorMessage && (
        <div className="p-4 text-sm text-red-500">
          Error Occurred: {errorMessage}
        </div>
      )}
      {gameVersion ? (
        step === 0 ? (
          <div className="p-4 space-y-2">
            <div className="text-sm font-medium">
              Detected Game Version: {gameVersion}
            </div>
            <div className="text-sm">
              Please select a mod loader below. More mod loaders may be
              supported in the future.
            </div>
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => onChooseModLoader("fabric")}
                className="rounded border border-gray-300 dark:border-gray-700 p-2 w-2/3 hover:text-indigo-500"
              >
                <div className="font-medium">Fabric</div>
                <div className="text-gray-500 text-xs">
                  Official website: https://fabricmc.net/
                </div>
              </button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="p-4 space-y-2">
            <div className="text-sm">
              Choose an available {modLoader} version for game version{" "}
              {gameVersion}.
            </div>
            {modLoaderVersions.length > 0 ? (
              <div>
                {modLoaderVersions.map((ver) => (
                  <ListItem
                    onClick={() => {
                      setSelectedModLoaderVersion(ver);
                      setStep(2);
                    }}
                    key={ver}
                  >
                    {ver}
                  </ListItem>
                ))}
              </div>
            ) : (
              <Spin />
            )}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            <div>
              <div>Please confirm the installation information:</div>
              <div>Game Version: {gameVersion}</div>
              <div>Mod Loader: {modLoader}</div>
              <div>Mod Loader Version: {selectedModLoaderVersion}</div>
              <div></div>
            </div>
            <Label
              className="flex items-center space-x-2"
              title="Name for new Instance"
              helper="Once you click the Install button, a new instance with the same game directory will be created."
            >
              <Input
                className="w-2/3"
                value={newInstanceName}
                onChange={setNewInstanceName}
              />
              <Button disabled={installing} onClick={onInstall}>
                Install
              </Button>
              {installing && <Spin />}
            </Label>
          </div>
        )
      ) : (
        <div className="p-4">
          <Spin />
        </div>
      )}
    </div>
  );
}
