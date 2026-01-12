import { CheckCircle, OctagonX, Plus } from "lucide-react";
import { Fragment, useContext, useState } from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import { AppContext } from "../store";
import type { MinecraftAccountCategory } from "../store/data";
import AccountEditorView from "./AccountEditorView";

function showMinecraftAccountCategory(category: MinecraftAccountCategory) {
  return {
    microsoft: "Microsoft",
    offline: "Offline",
    custom: "Custom",
  }[category];
}

export default function AccountsView() {
  const app = useContext(AppContext);
  const data = app.getData();

  const current = data.accounts.find((account) => account.checked);
  const [showing, setShowing] = useState<"list" | "create">("list");
  const [notAfter, setNotAfter] = useState<[string, Date | null] | undefined>();

  const onBackToList = () => setShowing("list");

  const onCheckAvailability = () => {
    if (current) {
      if (current?.userHash && current?.xblToken && current?.xblNotAfter) {
        setNotAfter([current.id, new Date(current.xblNotAfter)]);
      } else setNotAfter([current.id, null]);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/5 border-r border-gray-300 dark:border-gray-700 p-2 space-y-1">
        <div className="flex justify-center">
          <IconButton onClick={() => setShowing("create")}>
            <Plus />
          </IconButton>
        </div>
        {data.accounts.map((account) => (
          <ListItem
            checked={account.checked}
            key={account.id}
            onClick={() => {
              app.setData((prevData) => {
                const former = account.checked;
                prevData.accounts.forEach((acc) => {
                  acc.checked = false;
                });
                if (!former) account.checked = true;
              });
            }}
          >
            {account.username}
          </ListItem>
        ))}
      </div>
      <div className="w-4/5">
        {showing === "create" && <AccountEditorView onBack={onBackToList} />}
        {showing === "list" &&
          (current ? (
            <div className="p-4 space-y-2">
              <Label title="Username">{current.username}</Label>
              <Label title="Category">
                {showMinecraftAccountCategory(current.category)}
              </Label>
              <Label title="Created at">
                {new Date(current.timestamp).toLocaleString()}
              </Label>
              {current.category === "microsoft" && (
                <div className="flex items-center space-x-4 text-sm">
                  <Button onClick={onCheckAvailability}>
                    Check availability
                  </Button>
                  {notAfter?.[0] === current.id && (
                    <Fragment>
                      {notAfter[1] === null && (
                        <div>Unable to check availability.</div>
                      )}
                      {notAfter[1] &&
                        (notAfter[1] > new Date() ? (
                          <div className="flex items-center space-x-2">
                            <CheckCircle size={16} />
                            <div>Your token is available until</div>
                            <div>{notAfter[1].toLocaleString()}</div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <OctagonX size={16} />
                            <div>Your token has expired at</div>
                            <div>{notAfter[1].toLocaleString()}</div>
                          </div>
                        ))}
                    </Fragment>
                  )}
                </div>
              )}
              <Button
                onClick={() => {
                  app.openDialog({
                    title: "Delete Account",
                    message: `Are you sure you want to delete the account '${current.username}'? This action cannot be undone.`,
                    action: () => {
                      app.setData((prevData) => {
                        prevData.accounts = prevData.accounts.filter(
                          (account) => account.id !== current.id,
                        );
                      });
                    },
                    danger: true,
                    actionMessage: "Delete",
                  });
                }}
                danger
              >
                Delete
              </Button>
            </div>
          ) : (
            <Center className="h-full">
              Choose an account on the list to view details.
            </Center>
          ))}
      </div>
    </div>
  );
}
