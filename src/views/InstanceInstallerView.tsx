import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { Fragment, useContext, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import { installMinecraft, type MinecraftVersion } from "../core/download";
import { AppContext } from "../store";

export default function InstanceInstallerView(props: {
  onBack: () => void;
  version: MinecraftVersion;
}) {
  const app = useContext(AppContext);
  const [dir, setDir] = useState(String());
  const [started, setStarted] = useState(false);

  const onInstall = () => {
    if (dir) {
      const danger = !dir.endsWith("minecraft");
      app.openDialog({
        title: "Install Confirmation",
        message: `Are you sure that ${dir} is the correct game directory?`,
        dangerMessage: danger
          ? "The directory does not end with 'minecraft'."
          : undefined,
        danger: true,
        actionMessage: danger ? "Install Anyway" : "Install",
        action: () => {
          const ver = props.version;
          app.setData((prevData) => {
            prevData.instances.push({
              id: nanoid(),
              timestamp: Date.now(),
              name: `Minecraft ${ver.id} (Downloaded)`,
              directory: dir,
              version: ver.id,
              checked: false,
            });
          });
          installMinecraft(ver, dir)
            .then(() => props.onBack())
            .catch((e) =>
              app.openDialog({
                title: "Error Occurred",
                message: `${e}`,
              }),
            );
          setStarted(true);
        },
      });
    }
  };

  return (
    <div className="p-2">
      <div className="flex items-center space-x-2">
        <IconButton onClick={props.onBack}>
          <ChevronLeft />
        </IconButton>
        <div className="font-medium">Install Minecraft {props.version.id}</div>
      </div>
      <div className="p-2 space-y-2">
        <div className="flex items-center">
          <Label
            title="Game Directory"
            helper="Usually 'minecraft' on macOS and Linux, '.minecraft' on Windows."
          >
            <Input
              className="w-full"
              value={dir}
              onChange={setDir}
              placeholder="Game Directory"
            />
          </Label>
          <div className="grow" />
          <Button disabled={started} onClick={onInstall}>
            Install
          </Button>
        </div>
        <div className="border border-t border-gray-300 dark:border-gray-700" />
        <div className="space-y-2 text-sm">
          {dir && (
            <Fragment>
              <div>
                When you click 'Install', a json file will be downloaded at:
              </div>
              <div className="italic">
                {dir}/versions/{props.version.id}/{props.version.id}.json
              </div>
              <div>
                Please check the path carefully before you click 'Install'.
              </div>
            </Fragment>
          )}
          <Label title="Tips">
            An instance will be created automatically after installation.
            Required libraries and assets will be downloaded when you launch the
            version.
          </Label>
        </div>
      </div>
    </div>
  );
}
