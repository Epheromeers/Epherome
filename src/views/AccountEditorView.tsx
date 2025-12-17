import { nanoid } from "nanoid";
import { Fragment, useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import RadioButton from "../components/RadioButton";
import {
  configStore,
  type MinecraftAccountCategory,
  saveConfig,
} from "../config";
import { AppContext } from "../store";

export default function AccountEditorView() {
  const app = useContext(AppContext);
  const [category, setCategory] = useState<MinecraftAccountCategory>("custom");
  const [uuid, setUUID] = useState(String());
  const [accessToken, setAccessToken] = useState(String());
  const [name, setName] = useState(String());

  const onBack = () => {
    app.setView("accounts");
  };

  return (
    <div className="space-y-3">
      <div className="text-lg font-medium pl-3">
        Create a new Minecraft Account
      </div>
      <Label title="Category">
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
      <div className="flex space-x-1 pl-3">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              configStore.data.accounts.push({
                id: nanoid(),
                timestamp: Date.now(),
                username: name,
                category,
                uuid,
                accessToken,
              });
              saveConfig();
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
