import { useContext, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { configStore } from "../config";
import { RouterContext } from "../router";

export default function AccountsView() {
  const [accounts, setAccounts] = useState(configStore.accounts);
  const router = useContext(RouterContext);

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => router.setView("accountEditor")}>Create</Button>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {accounts.map((value) => (
          <Card key={value.username}>
            <div className="text-sm font-medium">{value.username}</div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  configStore.accounts = configStore.accounts.filter(
                    (account) => account.username !== value.username,
                  );
                  setAccounts(configStore.accounts);
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
