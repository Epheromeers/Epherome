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
    <div>
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => router.setView("accountEditor")}>Create</Button>
      </div>
      <div>
        {accounts.map((value) => (
          <Card key={value.username} className="flex">
            <div>{value.username}</div>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
