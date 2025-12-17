import { nanoid } from "nanoid";
import { Fragment, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import RadioButton from "../components/RadioButton";
import {
  configStore,
  type MinecraftAccountCategory,
  saveConfig,
} from "../config";

export default function AccountEditorView(props: { onBack: () => void }) {
  const [category, setCategory] = useState<MinecraftAccountCategory>("custom");
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
      <div className="flex space-x-1">
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
