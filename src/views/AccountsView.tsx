import { CheckCircle, LogIn, OctagonX, Plus, ShieldCheck } from "lucide-react";
import { Fragment, useContext, useRef, useState } from "react";
import Button from "../components/Button";
import Center from "../components/Center";
import IconButton from "../components/IconButton";
import Label from "../components/Label";
import ListItem from "../components/ListItem";
import Spin from "../components/Spin";
import {
  authenticateMicrosoftAccount,
  getMicrosoftAccountTokenExpiry,
} from "../core/auth";
import { getSkin } from "../core/skin";
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

function normalizeMinecraftUuid(uuid: string) {
  return uuid.replace(/-/g, "").toLowerCase();
}

export default function AccountsView() {
  const app = useContext(AppContext);
  const data = app.getData();
  const dataRef = useRef(data);
  dataRef.current = data;

  const current = data.accounts.find((account) => account.checked);
  const [showing, setShowing] = useState<"list" | "create">("list");
  const [notAfter, setNotAfter] = useState<[string, Date | null] | undefined>();
  const [skin, setSkin] = useState<string | null>(null);
  const [authenticatingAccountId, setAuthenticatingAccountId] = useState<
    string | null
  >(null);

  const onBackToList = () => setShowing("list");

  const onCheckAvailability = () => {
    if (current) {
      setNotAfter([current.id, getMicrosoftAccountTokenExpiry(current)]);
    }
  };

  const authenticateAgain = async (accountId: string, originalUuid: string) => {
    setAuthenticatingAccountId(accountId);
    try {
      const authenticatedAccount = await authenticateMicrosoftAccount();
      if (!authenticatedAccount) return;

      if (
        normalizeMinecraftUuid(authenticatedAccount.uuid) !==
        normalizeMinecraftUuid(originalUuid)
      ) {
        throw new Error(
          "The signed-in Microsoft account does not match the original account.",
        );
      }

      const target = dataRef.current.accounts.find(
        (account) => account.id === accountId,
      );
      if (!target) {
        throw new Error("The account no longer exists.");
      }

      app.setData((prevData) => {
        const account = prevData.accounts.find((item) => item.id === accountId);
        if (!account) return;

        account.username = authenticatedAccount.username;
        account.uuid = authenticatedAccount.uuid;
        account.xblToken = authenticatedAccount.xblToken;
        account.xblNotAfter = authenticatedAccount.xblNotAfter;
        account.userHash = authenticatedAccount.userHash;
        account.accessToken = authenticatedAccount.accessToken;
      });
      setNotAfter([accountId, new Date(authenticatedAccount.xblNotAfter)]);
      setSkin(null);
    } catch (err) {
      app.openDialog({
        title: "Re-login Failed",
        message: `Failed to re-login Microsoft account:\n${err}`,
      });
    } finally {
      setAuthenticatingAccountId(null);
    }
  };

  const onRelogin = () => {
    if (current?.category !== "microsoft") return;

    if (!current.uuid) {
      app.openDialog({
        title: "Re-login Failed",
        message:
          "Unable to verify the Microsoft account because its original UUID is missing.",
      });
      return;
    }

    const accountId = current.id;
    const originalUuid = current.uuid;
    const expiry = getMicrosoftAccountTokenExpiry(current);
    setNotAfter([accountId, expiry]);

    const startAuthentication = () => {
      void authenticateAgain(accountId, originalUuid);
    };

    if (expiry && expiry > new Date()) {
      app.openDialog({
        title: "Re-login",
        message:
          "The token is still valid. You only need to re-login after it expires. Are you sure you want to re-login?",
        action: startAuthentication,
        actionMessage: "Re-login",
      });
      return;
    }

    startAuthentication();
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
                const target = prevData.accounts.find(
                  (item) => item.id === account.id,
                );
                const former = target?.checked;
                prevData.accounts.forEach((acc) => {
                  acc.checked = false;
                });
                if (!former && target) target.checked = true;
              });
            }}
          >
            {account.category === "microsoft" && (
              <img
                width={24}
                src={`https://minotar.net/avatar/${account.uuid}`}
                alt="avatar"
              />
            )}
            <div>{account.username}</div>
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
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-4">
                    <Button onClick={onCheckAvailability}>
                      <ShieldCheck size={16} />
                      <div>Check availability</div>
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
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    If the token is unavailable, use Re-login to make it
                    available again.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={authenticatingAccountId !== null}
                      onClick={onRelogin}
                    >
                      <LogIn size={16} />
                      <div>Re-login</div>
                    </Button>
                    {authenticatingAccountId === current.id && <Spin />}
                  </div>
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
              {current.category === "microsoft" && (
                <Label title="Skin Viewer">
                  <Button
                    onClick={() => {
                      getSkin(current).then(setSkin);
                    }}
                  >
                    View Skin
                  </Button>
                  {skin && <img src={skin} alt="Skin" />}
                </Label>
              )}
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
