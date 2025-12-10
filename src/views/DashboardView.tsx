import { useState } from "react";
import Button from "../components/Button";
import { configStore } from "../config";
import { launchMinecraft } from "../core";

export default function DashboardView() {
  const [started, setStarted] = useState(false);

  const account = configStore.data.accounts.find((account) => account.checked);
  const instance = configStore.data.instances.find(
    (instance) => instance.checked,
  );

  return (
    <div>
      <div>Welcome to Epherome!</div>
      <div>Account: {account ? account.username : "None"}</div>
      <div>Instance: {instance ? instance.name : "None"}</div>
      <div>
        Currently, the Java path in the settings will not be used, the Java in
        the environment variable PATH will be used instead.
      </div>
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
    </div>
  );
}
