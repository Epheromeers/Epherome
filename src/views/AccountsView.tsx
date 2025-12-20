import { FilePlus } from "lucide-react";
import { useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
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
          <button
            type="button"
            className={`block py-1 px-3 text-sm font-medium w-full rounded text-left ${account.checked ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600"}`}
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
          </button>
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
