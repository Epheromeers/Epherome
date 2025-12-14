import { useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Label from "../components/Label";
import { configStore } from "../config";
import { launchMinecraft } from "../core";

export default function DashboardView() {
  const [started, setStarted] = useState(false);

  const account = configStore.data.accounts.find((account) => account.checked);
  const instance = configStore.data.instances.find(
    (instance) => instance.checked,
  );

  return (
    <div className="flex flex-col h-full p-6">
      <Card className="text-sm">
        <div>Welcome to Epherome!</div>
        <div>
          Currently, the Java path in the settings will not be used, the Java in
          the environment variable PATH will be used instead.
        </div>
      </Card>
      <div className="grow" />
      <div className="flex items-center space-x-3">
        <Button
          onClick={() => {
            if (account && instance) {
              setStarted(true);
              launchMinecraft(account, instance).then(() => setStarted(false));
            }
          }}
          disabled={started || !account || !instance}
        >
          Launch
        </Button>
        <div className="grow" />
        <div>
          <Label>Account</Label>
          <div className="pl-3">{account ? account.username : "None"}</div>
        </div>
        <div>
          <Label>Instance</Label>
          <div className="pl-3">{instance ? instance.name : "None"}</div>
        </div>
      </div>
    </div>
  );
}
