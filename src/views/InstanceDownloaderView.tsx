import { nanoid } from "nanoid";
import { useContext, useEffect, useState } from "react";
import Button from "../components/Button";
import Checkbox from "../components/Checkbox";
import Input from "../components/Input";
import { configStore, saveConfig } from "../config";
import {
  installMinecraft,
  type MinecraftVersionManifest,
} from "../core/download";
import { AppContext } from "../store";

export default function InstanceDownloaderView() {
  const app = useContext(AppContext);
  const [versionList, setVersionList] =
    useState<MinecraftVersionManifest | null>(null);
  const [release, setRelease] = useState(true);
  const [snapshot, setSnapshot] = useState(false);
  const [old, setOld] = useState(false);
  const [gameDirectory, setGameDirectory] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json")
      .then((res) => res.json())
      .then(setVersionList);
  }, []);

  const onInstall = () => {
    if (selected && versionList && gameDirectory) {
      const ver = versionList.versions.find((v) => v.id === selected);
      if (ver) {
        configStore.data.instances.push({
          id: nanoid(),
          timestamp: Date.now(),
          name: `Minecraft ${ver.id} (Downloaded)`,
          directory: gameDirectory,
          version: ver.id,
          checked: false,
        });
        saveConfig();
        installMinecraft(ver, gameDirectory).then(() =>
          app.setView("instances"),
        );
        setStarted(true);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <Button onClick={() => app.setView("instances")}>Back</Button>
        <Checkbox checked={release} onChange={setRelease}>
          Release
        </Checkbox>
        <Checkbox checked={snapshot} onChange={setSnapshot}>
          Snapshot
        </Checkbox>
        <Checkbox checked={old} onChange={setOld}>
          Old
        </Checkbox>
      </div>
      <div className="flex space-x-3">
        <Input
          placeholder="Game Directory (minecraft)"
          value={gameDirectory}
          onChange={setGameDirectory}
        />
        <div>Version to install: {selected ?? "None"}</div>
        <Button disabled={started} onClick={onInstall}>
          Install
        </Button>
      </div>
      <div className="text-sm">
        Currently, installing a Minecraft version will only save the version
        JSON file. JAR file and other libraries will be downloaded when
        launched.
      </div>
      <div>
        {versionList?.versions.map(
          (ver) =>
            ((release && ver.type === "release") ||
              (snapshot && ver.type === "snapshot") ||
              (old &&
                (ver.type === "old_alpha" || ver.type === "old_beta"))) && (
              <button
                type="button"
                key={ver.id}
                className={`flex space-x-3 ${selected === ver.id && "text-blue-600"}`}
                onClick={() => setSelected(ver.id)}
              >
                <div>{ver.id}</div>
                <div className="text-gray-500">{ver.type}</div>
              </button>
            ),
        ) ?? "Loading"}
      </div>
    </div>
  );
}
