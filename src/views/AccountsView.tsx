import { useContext, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore, saveConfig } from "../config";
import { AppContext } from "../store";

export default function AccountsView() {
  const [accounts, setAccounts] = useState(configStore.data.accounts);
  const app = useContext(AppContext);

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => app.setView("accountEditor")}>Create</Button>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {accounts.map((value) => (
          <Card key={value.username}>
            <div className="text-sm font-medium">{value.username}</div>
            <Label title="Category">{value.category}</Label>
            <div className="flex space-x-1 justify-end">
              <Button
                onClick={() => {
                  const former = value.checked;
                  configStore.data.accounts.forEach((acc) => {
                    acc.checked = false;
                  });
                  if (!former) value.checked = true;
                  saveConfig();
                  setAccounts(Array.from(configStore.data.accounts));
                }}
              >
                {value.checked ? "Deselect" : "Select"}
              </Button>
              <Button
                onClick={() => {
                  configStore.data.accounts = configStore.data.accounts.filter(
                    (account) => account.username !== value.username,
                  );
                  saveConfig();
                  setAccounts(configStore.data.accounts);
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
