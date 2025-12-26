import { useContext } from "react";
import Button from "../components/Button";
import Label from "../components/Label";
import { launchMinecraft } from "../core";
import { AppContext } from "../store";

export default function DashboardView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const account = data.accounts.find((account) => account.checked);
  const instance = data.instances.find((instance) => instance.checked);

  return (
    <div className="flex flex-col h-full p-6">
      <div className="grow" />
      <div>{app.getLaunchMessage()}</div>
      <div className="flex items-center space-x-3">
        <Button
          onClick={() => {
            if (account && instance) {
              launchMinecraft(app, account, instance, app.setLaunchMessage)
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
        <Label title="Account">{account ? account.username : "None"}</Label>
        <Label title="Instance">{instance ? instance.name : "None"}</Label>
      </div>
    </div>
  );
}
