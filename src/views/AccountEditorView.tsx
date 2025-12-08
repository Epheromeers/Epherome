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
import { RouterContext } from "../router";

export default function AccountEditorView() {
  const router = useContext(RouterContext);
  const [category, setCategory] = useState<MinecraftAccountCategory>("custom");
  const [uuid, setUUID] = useState(String());
  const [accessToken, setAccessToken] = useState(String());
  const [name, setName] = useState(String());

  const onBack = () => {
    router.setView("accounts");
  };

  return (
    <div className="space-y-3">
      <div className="text-lg font-medium pl-3">
        Create a new Minecraft Account
      </div>
      <div className="flex items-center space-x-3">
        <Label>Category</Label>
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
      </div>
      <div className="flex flex-col space-y-1">
        <Label>Username</Label>
        <Input value={name} placeholder="Username" onChange={setName} />
      </div>
      {category === "custom" && (
        <Fragment>
          <div className="flex flex-col space-y-1">
            <Label>UUID</Label>
            <Input value={uuid} placeholder="UUID" onChange={setUUID} />
          </div>
          <div className="flex flex-col space-y-1">
            <Label>Access Token</Label>
            <Input
              value={accessToken}
              placeholder="Access Token"
              onChange={setAccessToken}
              password
            />
          </div>
        </Fragment>
      )}
      <div className="flex space-x-1 pl-3">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              configStore.data.accounts.push({
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
