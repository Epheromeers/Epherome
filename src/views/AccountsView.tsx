import { FilePlus } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import { configStore, saveConfig } from "../config";
import AccountEditorView from "./AccountEditorView";

export default function AccountsView() {
  const [accounts, setAccounts] = useState(configStore.data.accounts);
  const currentAccount = accounts.find((acc) => acc.checked);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1">
        <div className="flex justify-center">
          <IconButton
            onClick={() => {
              setCreating(true);
              setAccounts(configStore.data.accounts);
            }}
          >
            <FilePlus />
          </IconButton>
        </div>
        {accounts.map((account) => (
          <ListItem
            checked={account.checked}
            key={account.id}
            onClick={() => {
              const former = account.checked;
              configStore.data.accounts.forEach((acc) => {
                acc.checked = false;
              });
              if (!former) account.checked = true;
              saveConfig();
              setAccounts(Array.from(configStore.data.accounts));
            }}
          >
            {account.username}
          </ListItem>
        ))}
      </div>
      {creating ? (
        <AccountEditorView onBack={() => setCreating(false)} />
      ) : currentAccount ? (
        <div className="w-4/5 p-3 space-y-2">
          <Label title="Username">{currentAccount.username}</Label>
          <Label title="Category">{currentAccount.category}</Label>
          <Button
            onClick={() => {
              configStore.data.accounts = configStore.data.accounts.filter(
                (account) => account.username !== currentAccount.username,
              );
              saveConfig();
              setAccounts(configStore.data.accounts);
            }}
            danger
          >
            Delete
          </Button>
        </div>
      ) : (
        <div className="w-4/5 flex justify-center items-center h-full text-gray-700">
          No Account Selected.
        </div>
      )}
    </div>
  );
}
