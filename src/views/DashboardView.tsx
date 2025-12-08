import Button from "../components/Button";
import { configStore } from "../config";

export default function DashboardView() {
  const account = configStore.data.accounts.find((account) => account.checked);
  const instance = configStore.data.instances.find(
    (instance) => instance.checked,
  );

  return (
    <div>
      <div>Welcome to Epherome!</div>
      <div>Account:{account ? account.username : "None"}</div>
      <div>Instance:{instance ? instance.name : "None"}</div>
      <Button>Launch</Button>
    </div>
  );
}
