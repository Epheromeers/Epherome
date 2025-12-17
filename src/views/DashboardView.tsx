import { useContext } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Label from "../components/Label";
import { configStore } from "../config";
import { launchMinecraft } from "../core";
import { AppContext } from "../store";

export default function DashboardView() {
  const app = useContext(AppContext);

  const account = configStore.data.accounts.find((account) => account.checked);
  const instance = configStore.data.instances.find(
    (instance) => instance.checked,
  );

  return (
    <div className="flex flex-col h-full p-6">
      <Card className="text-sm">
        <div>Welcome to Epherome!</div>
      </Card>
      <div className="grow" />
      <div>{app.getLaunchMessage()}</div>
      <div className="flex items-center space-x-3">
        <Button
          onClick={() => {
            if (account && instance) {
              launchMinecraft(account, instance, app.setLaunchMessage).then();
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
