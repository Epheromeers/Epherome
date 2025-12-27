import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { Fragment, useContext, useState } from "react";
import Button from "../components/Button";
import IconButton from "../components/IconButton";
import Input from "../components/Input";
import Label from "../components/Label";
import RadioButton from "../components/RadioButton";
import {
  getAuthCode,
  getAuthToken,
  getMinecraftProfile,
  getMinecraftToken,
  getXBLToken,
  getXSTSToken,
} from "../core/auth";
import { AppContext } from "../store";
import type { MinecraftAccount, MinecraftAccountCategory } from "../store/data";

async function createMicrosoftAccount(): Promise<MinecraftAccount> {
  const authCode = await getAuthCode();
  const authToken = await getAuthToken(authCode);
  const { xblToken, userHash } = await getXBLToken(authToken);
  const xstsToken = await getXSTSToken(xblToken);
  const mcToken = await getMinecraftToken(userHash, xstsToken);
  const { id, name } = await getMinecraftProfile(mcToken);
  return {
    id: nanoid(),
    timestamp: Date.now(),
    username: name,
    category: "microsoft",
    uuid: id,
    accessToken: mcToken,
  };
}

export default function AccountEditorView(props: { onBack: () => void }) {
  const app = useContext(AppContext);

  const [category, setCategory] =
    useState<MinecraftAccountCategory>("microsoft");
  const [uuid, setUUID] = useState(String());
  const [accessToken, setAccessToken] = useState(String());
  const [name, setName] = useState(String());
  const [authenticating, setAuthenticating] = useState(false);

  const onBack = () => {
    props.onBack();
  };

  const onMicrosoftAuthenticate = () => {
    createMicrosoftAccount()
      .then((account) => {
        app.setData((prev) => {
          prev.accounts.push(account);
        });
        onBack();
      })
      .catch((err) => {
        app.openDialog({
          title: "Error",
          message: `Failed to add Microsoft account:\n${err}`,
        });
        setAuthenticating(false);
      });
    setAuthenticating(true);
  };

  return (
    <div className="p-2">
      <div className="flex items-center space-x-2">
        <IconButton onClick={onBack}>
          <ChevronLeft />
        </IconButton>
        <div className="font-medium">Edit Minecraft Account</div>
      </div>
      <div className="p-2 space-y-2">
        <div className="flex items-center space-x-2 px-4">
          <div className="text-sm font-medium mr-8">Category</div>
          <RadioButton
            onClick={() => setCategory("microsoft")}
            checked={category === "microsoft"}
          >
            Microsoft
          </RadioButton>
          <RadioButton
            onClick={() => setCategory("offline")}
            checked={category === "offline"}
          >
            Offline
          </RadioButton>
          <RadioButton
            onClick={() => setCategory("custom")}
            checked={category === "custom"}
          >
            Custom
          </RadioButton>
        </div>
        <div className="p-2">
          {category === "microsoft" ? (
            <Button disabled={authenticating} onClick={onMicrosoftAuthenticate}>
              Authenticate
            </Button>
          ) : (
            <div className="space-y-2">
              <Label title="Username">
                <Input value={name} placeholder="Username" onChange={setName} />
              </Label>
              {category === "custom" && (
                <Fragment>
                  <Label title="UUID">
                    <Input value={uuid} placeholder="UUID" onChange={setUUID} />
                  </Label>
                  <Label title="Access Token">
                    <Input
                      value={accessToken}
                      placeholder="Access Token"
                      onChange={setAccessToken}
                      password
                    />
                  </Label>
                </Fragment>
              )}
              <div className="py-2">
                <Button
                  onClick={() => {
                    if (name) {
                      app.setData((prev) => {
                        prev.accounts.push({
                          id: nanoid(),
                          timestamp: Date.now(),
                          username: name,
                          category,
                          uuid,
                          accessToken,
                        });
                      });
                      onBack();
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
