import { useContext, useState } from "react";
import Button from "../components/Button";
import Label from "../components/Label";
import { launchMinecraft } from "../core";
import type { ParallelTask } from "../core/parallel";
import { AppContext } from "../store";
import Link from "../components/Link";

export default function DashboardView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const account = data.accounts.find((account) => account.checked);
  const instance = data.instances.find((instance) => instance.checked);

  const [downloadList, setDownloadList] = useState<ParallelTask[]>([]);

  return (
    <div className="flex flex-col h-full p-6">
      <div className="rounded border border-gray-300 dark:border-gray-700 p-2 text-sm">
        <div>
          Welcome to Epherome! It is very unstable and incomplete currently,
          with many potential bugs.
        </div>
        <div className="flex items-center space-x-2">
          <div>User guides will be available on:</div>
          <Link target="https://epherome.com">https://epherome.com</Link>
        </div>
        <div className="flex items-center space-x-2">
          <div>Open source at:</div>
          <Link target="https://github.com/Epheromeers/Epherome">
            https://github.com/Epheromeers/Epherome
          </Link>
        </div>
      </div>
      {downloadList.map((item) => (
        <div key={item.id}>Downloading {item.name}...</div>
      ))}
      <div className="grow" />
      <div>{app.getLaunchMessage()}</div>
      <div className="flex items-center space-x-3">
        <Button
          onClick={() => {
            if (account && instance) {
              launchMinecraft(
                app,
                account,
                instance,
                app.setLaunchMessage,
                setDownloadList,
              )
                .then()
                .catch((e) => {
                  app.openDialog({
                    title: "Launch Failed",
                    message: `${e}`,
                  });
                });
            }
          }}
          disabled={
            typeof app.getLaunchMessage() === "string" || !account || !instance
          }
        >
          Launch
        </Button>
        <div className="grow" />
        <div>
          <Label title="Account">{account ? account.username : "None"}</Label>
          <Label title="Instance">{instance ? instance.name : "None"}</Label>
        </div>
      </div>
    </div>
  );
}
