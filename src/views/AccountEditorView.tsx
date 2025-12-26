import { nanoid } from "nanoid";
import { Fragment, useContext, useState } from "react";
import Button from "../components/Button";
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

  const onBack = () => {
    props.onBack();
  };

  return (
    <div className="space-y-3 p-4">
      <div className="text-lg font-medium">Edit Minecraft Account</div>
      <Label title="Category" className="flex space-x-3">
        <RadioButton
          onClick={() => setCategory("microsoft")}
          checked={category === "microsoft"}
        >
          Microsoft
        </RadioButton>
        <RadioButton
          onClick={() => setCategory("custom")}
          checked={category === "custom"}
        >
          Custom
        </RadioButton>
        <RadioButton
          onClick={() => setCategory("offline")}
          checked={category === "offline"}
        >
          Offline
        </RadioButton>
      </Label>
      {category === "microsoft" ? (
        <div>
          <Button
            onClick={() => {
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
                });
            }}
          >
            Click Me!
          </Button>
        </div>
      ) : category === "offline" ? (
        <Label title="Username">
          <Input value={name} placeholder="Username" onChange={setName} />
        </Label>
      ) : (
        <Fragment>
          <Label title="Username">
            <Input value={name} placeholder="Username" onChange={setName} />
          </Label>
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
      <div className="flex space-x-1">
        <Button onClick={onBack}>Cancel</Button>
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
  );
}
