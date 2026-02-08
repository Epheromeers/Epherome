import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import Checkbox from "../components/Checkbox";
import IconButton from "../components/IconButton";
import Spin from "../components/Spin";
import type {
  MinecraftVersion,
  MinecraftVersionManifest,
} from "../core/download";
import { fetch } from "../utils/http";

export default function InstanceDownloaderView(props: {
  onBack: (version?: MinecraftVersion) => void;
}) {
  const [versionList, setVersionList] =
    useState<MinecraftVersionManifest | null>(null);
  const [release, setRelease] = useState(true);
  const [snapshot, setSnapshot] = useState(false);
  const [old, setOld] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://piston-meta.mojang.com/mc/game/version_manifest.json").then(
      (res) => setVersionList(JSON.parse(res.text || "{}")),
    );
  }, []);

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center space-x-2">
        <IconButton onClick={() => props.onBack()}>
          <ChevronLeft />
        </IconButton>
        <div className="font-medium grow">Minecraft Version List</div>
        <IconButton
          onClick={() =>
            props.onBack(
              versionList?.versions.find((ver) => ver.id === selected),
            )
          }
        >
          <div className="font-medium mr-2">Next</div>
          <ChevronRight />
        </IconButton>
      </div>
      <div className="flex items-center space-x-2 px-4">
        <div className="text-sm font-medium mr-8">Filters</div>
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
      <div className="space-y-2">
        {versionList?.versions.map(
          (ver) =>
            ((release && ver.type === "release") ||
              (snapshot && ver.type === "snapshot") ||
              (old &&
                (ver.type === "old_alpha" || ver.type === "old_beta"))) && (
              <button
                type="button"
                key={ver.id}
                className={`flex w-full rounded px-4 py-2 space-x-4 ${selected === ver.id ? "text-blue-600 dark:text-blue-400 bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                onClick={() => setSelected(ver.id)}
              >
                <div className="grow font-medium text-left">{ver.id}</div>
                <div className="text-gray-500">{ver.type}</div>
              </button>
            ),
        ) ?? (
          <div className="p-4">
            <Spin />
          </div>
        )}
      </div>
    </div>
  );
}
